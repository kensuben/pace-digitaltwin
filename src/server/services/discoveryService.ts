import { z } from "zod";

import { batchSchema, collectorSchema, createRunSchema, finalizeSchema, leaseSchema, scopeSchema } from "@/domain/discovery/contracts";
import { requireDiscoveryCampus, requireDiscoveryRole, type DiscoveryPrincipal } from "@/server/discovery/auth";
import { AppError } from "@/server/errors";
import { PrismaDiscoveryRepository, type DiscoveryRepository } from "@/server/repositories/discoveryRepository";

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new AppError("INVALID_DISCOVERY_INPUT", result.error.issues[0]?.message ?? "Invalid Discovery input.", 400);
  return result.data;
}

export class DiscoveryService {
  constructor(private readonly repository: DiscoveryRepository = new PrismaDiscoveryRepository()) {}

  async list(principal: DiscoveryPrincipal) {
    requireDiscoveryRole(principal, ["ADMIN", "EDITOR", "VIEWER"]);
    const [collectors, scopes, runs] = await Promise.all([
      this.repository.listCollectors(principal.campusIds),
      this.repository.listScopes(principal.campusIds),
      this.repository.listRuns(principal.campusIds),
    ]);
    return { mode: "MOCK" as const, principal, collectors, scopes, runs };
  }

  async createCollector(input: unknown, principal: DiscoveryPrincipal) {
    requireDiscoveryRole(principal, ["ADMIN"]);
    const data = parse(collectorSchema, input);
    requireDiscoveryCampus(principal, data.campusId);
    return this.repository.createCollector(data);
  }

  async createScope(input: unknown, principal: DiscoveryPrincipal) {
    requireDiscoveryRole(principal, ["ADMIN"]);
    const data = parse(scopeSchema, input);
    requireDiscoveryCampus(principal, data.campusId);
    const collector = await this.repository.findCollector(data.collectorId);
    if (!collector || collector.campusId !== data.campusId || !collector.enabled || collector.mode !== data.mode)
      throw new AppError("INVALID_COLLECTOR", "Choose an enabled collector in the same campus and mode.", 400);
    return this.repository.createScope(data, principal.id);
  }

  async createRun(input: unknown, principal: DiscoveryPrincipal) {
    requireDiscoveryRole(principal, ["ADMIN", "EDITOR"]);
    const data = parse(createRunSchema, input);
    const scope = await this.repository.findScope(data.scopeId);
    if (!scope) throw new AppError("SCOPE_NOT_FOUND", "Scope was not found.", 404);
    requireDiscoveryCampus(principal, scope.campusId);
    await this.repository.reap({ id: scope.id });
    return this.repository.createRun(data, principal.id);
  }

  private async authorizeRun(id: string, principal: DiscoveryPrincipal) {
    const run = await this.repository.findRunContext(id);
    if (!run) throw new AppError("RUN_NOT_FOUND", "Run was not found.", 404);
    requireDiscoveryCampus(principal, run.scope.campusId);
    return run;
  }

  async getRun(id: string, principal: DiscoveryPrincipal) {
    requireDiscoveryRole(principal, ["ADMIN", "EDITOR", "VIEWER"]);
    const run = await this.authorizeRun(id, principal);
    await this.repository.reap({ id: run.scopeId });
    return this.repository.getRun(id);
  }

  async cancelRun(id: string, principal: DiscoveryPrincipal) {
    requireDiscoveryRole(principal, ["ADMIN", "EDITOR"]);
    await this.authorizeRun(id, principal);
    return this.repository.cancel(id, principal.id);
  }

  private async collector(principal: DiscoveryPrincipal) {
    requireDiscoveryRole(principal, ["COLLECTOR"]);
    const collector = principal.collectorId ? await this.repository.findCollector(principal.collectorId) : null;
    if (!collector?.enabled) throw new AppError("INVALID_COLLECTOR", "Collector is disabled or unregistered.", 403);
    requireDiscoveryCampus(principal, collector.campusId);
    return collector;
  }

  async claim(principal: DiscoveryPrincipal) {
    const collector = await this.collector(principal);
    return this.repository.claim(collector.id, principal.id);
  }

  async heartbeat(input: unknown, principal: DiscoveryPrincipal) {
    const collector = await this.collector(principal);
    return this.repository.heartbeat(parse(leaseSchema, input), collector.id);
  }

  async ingest(input: unknown, principal: DiscoveryPrincipal) {
    const collector = await this.collector(principal);
    return this.repository.ingest(parse(batchSchema, input), collector.id, principal.id);
  }

  async finalize(input: unknown, principal: DiscoveryPrincipal) {
    const collector = await this.collector(principal);
    return this.repository.finalize(parse(finalizeSchema, input), collector.id, principal.id);
  }
}
