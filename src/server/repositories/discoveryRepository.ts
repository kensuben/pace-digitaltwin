import { randomUUID } from "node:crypto";

import {
  addressInScope, DEADLINE_MS, LEASE_MS, MAX_ATTEMPTS, MAX_BATCHES,
  MAX_DISCOVERY_TARGETS, type BatchInput, type CollectorInput, type FinalizeInput,
  type LeaseInput, type RunInput, type ScopeInput,
} from "@/domain/discovery/contracts";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { getPrismaClient } from "@/server/db/client";
import { asJson, contentHash } from "@/server/discovery/json";
import { AppError } from "@/server/errors";

type Tx = Prisma.TransactionClient;
type RunContext = Prisma.DiscoveryRunGetPayload<{ include: { scope: true } }>;
const terminal = ["SUCCEEDED", "PARTIAL", "FAILED", "CANCELLED"] as const;

export class PrismaDiscoveryRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  listCollectors(campusIds: string[]) {
    return this.prisma.discoveryCollector.findMany({
      where: { campusId: { in: campusIds } }, orderBy: { createdAt: "desc" }, take: 100,
    });
  }

  createCollector(input: CollectorInput) {
    return this.prisma.discoveryCollector.create({ data: input });
  }

  findCollector(id: string) {
    return this.prisma.discoveryCollector.findUnique({ where: { id } });
  }

  listScopes(campusIds: string[]) {
    return this.prisma.discoveryScope.findMany({
      where: { campusId: { in: campusIds } }, orderBy: { createdAt: "desc" }, take: 100,
    });
  }

  createScope(input: ScopeInput, actorId: string) {
    return this.prisma.discoveryScope.create({ data: { ...input, createdBy: actorId } });
  }

  findScope(id: string) {
    return this.prisma.discoveryScope.findUnique({ where: { id } });
  }

  findRunContext(id: string) {
    return this.prisma.discoveryRun.findUnique({ where: { id }, include: { scope: true } });
  }

  async listRuns(campusIds: string[]) {
    await this.reap({ campusId: { in: campusIds } });
    const runs = await this.prisma.discoveryRun.findMany({
      where: { scope: { campusId: { in: campusIds } } },
      include: { scope: true, snapshot: { select: { deviceCount: true, linkCount: true, contentHash: true } } },
      orderBy: { createdAt: "desc" }, take: 100,
    });
    return runs.map(publicRun);
  }

  async getRun(id: string) {
    const run = await this.prisma.discoveryRun.findUnique({
      where: { id }, include: {
        scope: true,
        snapshot: true,
        batches: { select: { batchId: true, checksum: true, payload: true, createdAt: true }, orderBy: { batchId: "asc" } },
        events: { orderBy: { createdAt: "asc" }, take: 100 },
      },
    });
    return run ? publicRun(run) : null;
  }

  async createRun(input: RunInput, actorId: string) {
    // Serializable retry makes the graph snapshot, idempotency check and scope lock atomic.
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "DiscoveryScope" WHERE "id" = ${input.scopeId} FOR UPDATE`;
          const scope = await tx.discoveryScope.findUnique({ where: { id: input.scopeId }, include: { collector: true } });
          if (!scope || !scope.collector.enabled)
            throw new AppError("SCOPE_UNAVAILABLE", "Discovery scope or collector is unavailable.", 409);
          const requestHash = contentHash(input);
          const previous = await tx.discoveryRun.findUnique({
            where: { createdBy_idempotencyKey: { createdBy: actorId, idempotencyKey: input.idempotencyKey } },
          });
          if (previous) {
            if (previous.requestHash !== requestHash)
              throw new AppError("IDEMPOTENCY_CONFLICT", "Idempotency key was used for another request.", 409);
            return publicRun(previous);
          }
          const active = await tx.discoveryRun.findFirst({
            where: { scopeId: scope.id, status: { in: ["QUEUED", "RUNNING"] } }, select: { id: true },
          });
          if (active) throw new AppError("SCOPE_BUSY", "This scope already has an active run.", 409);
          const scenario = await tx.scenario.findUnique({ where: { id: input.scenarioId }, select: { id: true, name: true, isLocked: true } });
          if (!scenario) throw new AppError("SCENARIO_NOT_FOUND", "Scenario was not found.", 404);
          const devices = await tx.deviceInstance.findMany({
            where: { scenarioId: scenario.id, building: { campusId: scope.campusId } },
            select: { id: true, hostname: true, serialNumber: true, managementIp: true, status: true,
              modelId: true, model: { select: { sku: true, vendor: { select: { code: true } } } },
              floorId: true, buildingId: true,
              ports: { select: { id: true, name: true, index: true, media: true, supportedSpeedsMbps: true }, orderBy: { id: "asc" } },
            }, orderBy: { id: "asc" },
          });
          if (devices.length > MAX_DISCOVERY_TARGETS)
            throw new AppError("DESIGN_TOO_LARGE", "Pilot design scope exceeds 1024 devices.", 400);
          // A scenario containing devices only in another campus is not accessible via this scope.
          if (!devices.length && await tx.deviceInstance.count({ where: { scenarioId: scenario.id } }))
            throw new AppError("SCENARIO_OUTSIDE_SCOPE", "Scenario has no devices in this campus.", 403);
          const ids = devices.map((device) => device.id);
          const links = await tx.physicalLink.findMany({
            where: { scenarioId: scenario.id, sourcePort: { deviceInstanceId: { in: ids } }, targetPort: { deviceInstanceId: { in: ids } } },
            select: { id: true, sourcePortId: true, targetPortId: true, speedMbps: true, status: true, linkType: true },
            orderBy: { id: "asc" },
          });
          const content = {
            contractVersion: 1, scenario, campusId: scope.campusId,
            inclusionPolicy: "ALL_CAMPUS_DEVICES_ALL_STATUSES_AND_INTERNAL_LINKS",
            cidrsAreCollectionOnly: true, devices, links,
          };
          const run = await tx.discoveryRun.create({ data: {
            ...input, requestHash, createdBy: actorId, deadlineAt: new Date(Date.now() + DEADLINE_MS),
            snapshot: { create: { contentHash: contentHash(content), contentJson: asJson(content), deviceCount: devices.length, linkCount: links.length } },
            events: { create: { actorId, action: "CREATED", detail: asJson({ mode: scope.mode, scopeId: scope.id }) } },
          } });
          return publicRun(run);
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
      } catch (error) {
        if (attempt < 3 && error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2002"].includes(error.code)) continue;
        throw error;
      }
    }
  }

  async reap(scopeFilter: Prisma.DiscoveryScopeWhereInput) {
    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const expired = await tx.discoveryRun.updateManyAndReturn({
        where: { scope: scopeFilter, status: { in: ["QUEUED", "RUNNING"] }, OR: [
          { deadlineAt: { lte: now } },
          { status: "RUNNING", attempts: { gte: MAX_ATTEMPTS }, leaseExpiresAt: { lte: now } },
        ] }, data: { status: "FAILED", errorCode: "COLLECTOR_DEADLINE_OR_RETRIES", completedAt: now, leaseExpiresAt: null },
      });
      if (expired.length) await tx.discoveryEvent.createMany({ data: expired.map((run) => ({
        runId: run.id, actorId: "discovery-system", action: "FAILED", detail: { reason: "DEADLINE_OR_RETRIES" },
      })) });
    });
  }

  async claim(collectorId: string, actorId: string) {
    await this.reap({ collectorId });
    return this.prisma.$transaction(async (tx) => {
      const collector = await tx.discoveryCollector.findUnique({ where: { id: collectorId } });
      if (!collector?.enabled) throw new AppError("COLLECTOR_DISABLED", "Collector is unavailable.", 403);
      await tx.discoveryCollector.update({ where: { id: collectorId }, data: { lastSeenAt: new Date() } });
      const candidates = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT r."id" FROM "DiscoveryRun" r JOIN "DiscoveryScope" s ON s."id" = r."scopeId"
        WHERE s."collectorId" = ${collectorId} AND r."deadlineAt" > NOW() AND r."attempts" < ${MAX_ATTEMPTS}
          AND (r."status" = 'QUEUED' OR (r."status" = 'RUNNING' AND r."leaseExpiresAt" <= NOW()))
        ORDER BY r."createdAt" FOR UPDATE OF r SKIP LOCKED LIMIT 1`;
      if (!candidates[0]) return null;
      const leaseToken = randomUUID();
      // Reclaimed runs restart collection. Prior observations are never mixed with the new attempt.
      await tx.discoveryBatch.deleteMany({ where: { runId: candidates[0].id } });
      const run = await tx.discoveryRun.update({ where: { id: candidates[0].id }, data: {
        status: "RUNNING", attempts: { increment: 1 }, leaseToken,
        leaseExpiresAt: new Date(Date.now() + LEASE_MS), startedAt: new Date(),
      }, include: { scope: true } });
      await event(tx, run.id, actorId, "CLAIMED", { attempt: run.attempts });
      return { runId: run.id, leaseToken, leaseExpiresAt: run.leaseExpiresAt, deadlineAt: run.deadlineAt,
        scope: run.scope, contractVersion: 1 };
    });
  }

  async heartbeat(input: LeaseInput, collectorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const run = await leasedRun(tx, input, collectorId);
      const leaseExpiresAt = new Date(Math.min(Date.now() + LEASE_MS, run.deadlineAt.getTime()));
      await tx.discoveryRun.update({ where: { id: run.id }, data: { leaseExpiresAt } });
      await tx.discoveryCollector.update({ where: { id: collectorId }, data: { lastSeenAt: new Date() } });
      return { runId: run.id, leaseExpiresAt };
    });
  }

  async ingest(input: BatchInput, collectorId: string, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const run = await leasedRun(tx, input, collectorId);
      const { leaseToken: _lease, runId: _run, ...payload } = input;
      void _lease; void _run;
      validateBatch(payload, run);
      const checksum = contentHash(payload);
      const previous = await tx.discoveryBatch.findUnique({ where: { runId_batchId: { runId: run.id, batchId: input.batchId } } });
      if (previous) {
        if (previous.checksum !== checksum) throw new AppError("BATCH_CONFLICT", "Batch ID already has different content.", 409);
        return { batchId: input.batchId, checksum, duplicate: true };
      }
      if (await tx.discoveryBatch.count({ where: { runId: run.id } }) >= MAX_BATCHES)
        throw new AppError("BATCH_LIMIT", "Run batch limit reached.", 400);
      await tx.discoveryBatch.create({ data: { runId: run.id, batchId: input.batchId, leaseToken: input.leaseToken, checksum, payload: asJson(payload) } });
      await event(tx, run.id, actorId, "BATCH_ACCEPTED", { batchId: input.batchId, checksum });
      return { batchId: input.batchId, checksum, duplicate: false };
    });
  }

  async finalize(input: FinalizeInput, collectorId: string, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const run = await lockedRun(tx, input.runId);
      await requireCollector(tx, run, collectorId);
      const finalizedHash = contentHash(input);
      if (run.finalizedHash === finalizedHash && run.leaseToken === input.leaseToken)
        return { runId: run.id, status: run.status, duplicate: true };
      requireLease(run, input.leaseToken);
      if (input.sources.some((source) => source.source !== "MOCK"))
        throw new AppError("MOCK_ONLY", "This release accepts mock evidence only.", 400);
      const batches = await tx.discoveryBatch.findMany({ where: { runId: run.id } });
      if (batches.length !== input.manifest.length || batches.some((batch) =>
        !input.manifest.some((item) => item.batchId === batch.batchId && item.checksum === batch.checksum)))
        throw new AppError("MANIFEST_MISMATCH", "Manifest must include exactly the accepted batches and checksums.", 409);
      const devices = new Map<string, BatchInput["devices"][number]>();
      const links: BatchInput["links"] = [];
      for (const batch of batches) {
        const payload = batch.payload as unknown as Omit<BatchInput, "leaseToken" | "runId">;
        for (const device of payload.devices) {
          if (devices.has(device.id)) throw new AppError("DUPLICATE_OBSERVATION", "Observation IDs must be unique across batches.", 400);
          devices.set(device.id, device);
        }
        links.push(...payload.links);
      }
      if (devices.size > MAX_DISCOVERY_TARGETS)
        throw new AppError("OBSERVATION_LIMIT", "Run exceeds 1024 observed devices.", 400);
      for (const link of links) {
        const a = devices.get(link.sourceDeviceId), b = devices.get(link.targetDeviceId);
        if (!a?.interfaces.some((port) => port.id === link.sourceInterfaceId) || !b?.interfaces.some((port) => port.id === link.targetInterfaceId))
          throw new AppError("UNRESOLVED_LINK", "Link references an unknown observation/interface.", 400);
      }
      const now = new Date();
      await tx.discoveryRun.update({ where: { id: run.id }, data: {
        status: input.status, resultJson: asJson({ sources: input.sources, deviceCount: devices.size, directedLinkCount: links.length,
          mode: "MOCK", manifest: input.manifest }),
        finalizedHash, completedAt: now, leaseExpiresAt: null,
      } });
      await event(tx, run.id, actorId, "FINALIZED", { status: input.status, finalizedHash });
      return { runId: run.id, status: input.status, duplicate: false };
    });
  }

  async cancel(id: string, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const run = await lockedRun(tx, id);
      if (run.status === "CANCELLED") return { runId: id, status: run.status };
      if ((terminal as readonly string[]).includes(run.status))
        throw new AppError("RUN_TERMINAL", "Completed runs cannot be cancelled.", 409);
      await tx.discoveryRun.update({ where: { id }, data: { status: "CANCELLED", completedAt: new Date(), leaseExpiresAt: null } });
      await event(tx, id, actorId, "CANCELLED", {});
      return { runId: id, status: "CANCELLED" as const };
    });
  }
}

function publicRun<T extends { leaseToken: string | null; finalizedHash: string | null; requestHash: string }>(run: T) {
  const { leaseToken, finalizedHash, requestHash, ...result } = run;
  void leaseToken; void finalizedHash; void requestHash;
  return result;
}

async function event(tx: Tx, runId: string, actorId: string, action: string, detail: Record<string, unknown>) {
  await tx.discoveryEvent.create({ data: { runId, actorId, action, detail: asJson(detail) } });
}

async function lockedRun(tx: Tx, id: string): Promise<RunContext> {
  await tx.$queryRaw`SELECT "id" FROM "DiscoveryRun" WHERE "id" = ${id} FOR UPDATE`;
  const run = await tx.discoveryRun.findUnique({ where: { id }, include: { scope: true } });
  if (!run) throw new AppError("RUN_NOT_FOUND", "Discovery run was not found.", 404);
  return run;
}

async function requireCollector(tx: Tx, run: RunContext, collectorId: string) {
  if (run.scope.collectorId !== collectorId || !await tx.discoveryCollector.findFirst({ where: { id: collectorId, enabled: true } }))
    throw new AppError("FORBIDDEN", "Run does not belong to this enabled collector.", 403);
}

function requireLease(run: RunContext, token: string) {
  if (run.status !== "RUNNING" || run.leaseToken !== token || !run.leaseExpiresAt ||
      run.leaseExpiresAt.getTime() <= Date.now() || run.deadlineAt.getTime() <= Date.now())
    throw new AppError("STALE_LEASE", "Run is cancelled, expired or owned by another attempt.", 409);
}

async function leasedRun(tx: Tx, input: LeaseInput, collectorId: string) {
  const run = await lockedRun(tx, input.runId);
  await requireCollector(tx, run, collectorId);
  requireLease(run, input.leaseToken);
  return run;
}

function validateBatch(payload: Omit<BatchInput, "leaseToken" | "runId">, run: RunContext) {
  const earliest = run.startedAt?.getTime() ?? run.createdAt.getTime();
  const validTime = (value: string) => new Date(value).getTime() >= earliest - 5000 && new Date(value).getTime() <= Date.now() + 5000;
  for (const device of payload.devices) {
    if (!addressInScope(device.ip, run.scope))
      throw new AppError("TARGET_OUTSIDE_SCOPE", "Observation address is outside the allowlist or excluded.", 400);
    if (device.source !== "MOCK") throw new AppError("MOCK_ONLY", "Live evidence is not enabled.", 400);
    if (!validTime(device.seenAt)) throw new AppError("INVALID_OBSERVATION_TIME", "Observation is stale or in the future.", 400);
    if (new Set(device.interfaces.map((port) => port.id)).size !== device.interfaces.length)
      throw new AppError("DUPLICATE_INTERFACE", "Interface IDs must be unique per observation.", 400);
  }
  for (const link of payload.links) {
    if (link.source !== "MOCK" || !validTime(link.seenAt) || Date.parse(link.expiresAt) <= Date.parse(link.seenAt) ||
        Date.parse(link.expiresAt) - Date.parse(link.seenAt) > 2 * 60 * 60_000 || link.sourceDeviceId === link.targetDeviceId)
      throw new AppError("INVALID_LINK_EVIDENCE", "Invalid link source, timestamps or endpoints.", 400);
  }
}

export type DiscoveryRepository = Pick<PrismaDiscoveryRepository, keyof PrismaDiscoveryRepository>;
