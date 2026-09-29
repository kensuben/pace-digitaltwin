import { z } from "zod";

import { ipv4InNetwork, parseIpv4Cidr } from "@/domain/network/ipv4";

export const DISCOVERY_CONTRACT_VERSION = 1;
export const MAX_DISCOVERY_TARGETS = 1024;
export const MAX_BATCH_BYTES = 512 * 1024;
export const MAX_BATCHES = 16;
export const LEASE_MS = 60_000;
export const DEADLINE_MS = 15 * 60_000;
export const MAX_ATTEMPTS = 3;

const id = z.string().trim().min(1).max(128);
const label = z.string().trim().min(1).max(200);
const ipv4 = z.ipv4();
export const cidrSchema = z.string().refine((value) => {
  const network = parseIpv4Cidr(value);
  return !!network && network.canonicalCidr === value && network.prefix >= 22;
}, "Use a canonical IPv4 CIDR, /22 or smaller.");

export const collectorSchema = z.strictObject({
  id,
  campusId: id,
  name: label,
  mode: z.literal("MOCK"),
});

export const scopeSchema = z.strictObject({
  campusId: id,
  collectorId: id,
  name: label,
  networkDomain: label,
  mode: z.literal("MOCK"),
  cidrs: z.array(cidrSchema).min(1).max(16),
  exclusions: z.array(ipv4).max(MAX_DISCOVERY_TARGETS).default([]),
}).superRefine((value, context) => {
  const networks = value.cidrs.map((cidr) => parseIpv4Cidr(cidr)!);
  const size = networks.reduce((sum, network) => sum + 2 ** (32 - network.prefix), 0);
  if (size > MAX_DISCOVERY_TARGETS)
    context.addIssue({ code: "custom", message: "Scope exceeds 1024 addresses." });
  for (let i = 0; i < networks.length; i++) {
    for (let j = 0; j < i; j++) {
      if (networks[i].network <= networks[j].broadcast && networks[j].network <= networks[i].broadcast)
        context.addIssue({ code: "custom", message: "CIDRs must not overlap." });
    }
  }
  if (value.exclusions.some((ip) => !networks.some((network) => ipv4InNetwork(ip, network))))
    context.addIssue({ code: "custom", message: "Excluded addresses must be inside the scope." });
});

export const createRunSchema = z.strictObject({
  scopeId: id,
  scenarioId: id,
  idempotencyKey: z.string().uuid(),
});

export const leaseSchema = z.strictObject({
  runId: id,
  leaseToken: z.string().uuid(),
});

const source = z.enum(["MOCK", "ARP", "ICMP", "TCP", "SNMP", "LLDP"]);
export const observationSchema = z.strictObject({
  id,
  ip: ipv4,
  hostname: label.optional(),
  serialNumber: label.optional(),
  vendor: label.optional(),
  model: label.optional(),
  mac: z.string().regex(/^(?:[0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/).optional(),
  seenAt: z.iso.datetime(),
  source,
  interfaces: z.array(z.strictObject({
    id,
    name: label,
    mac: z.string().regex(/^(?:[0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/).optional(),
    operationalStatus: z.enum(["UP", "DOWN", "UNKNOWN"]),
  })).max(256),
});

export const observedLinkSchema = z.strictObject({
  sourceDeviceId: id,
  sourceInterfaceId: id,
  targetDeviceId: id,
  targetInterfaceId: id,
  source: z.enum(["MOCK", "LLDP"]),
  seenAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
});

export const batchSchema = leaseSchema.extend({
  batchId: z.string().uuid(),
  contractVersion: z.literal(DISCOVERY_CONTRACT_VERSION),
  devices: z.array(observationSchema).max(128),
  links: z.array(observedLinkSchema).max(512),
});

export const finalizeSchema = leaseSchema.extend({
  manifest: z.array(z.strictObject({
    batchId: z.string().uuid(),
    checksum: z.string().regex(/^[a-f0-9]{64}$/),
  })).max(MAX_BATCHES),
  status: z.enum(["SUCCEEDED", "PARTIAL", "FAILED"]),
  sources: z.array(z.strictObject({
    source,
    status: z.enum(["COMPLETE", "PARTIAL", "UNAVAILABLE"]),
    errorCode: z.enum(["TIMEOUT", "AUTH_FAILED", "UNSUPPORTED", "CANCELLED", "COLLECTION_FAILED"]).optional(),
  })).min(1).max(6),
}).superRefine((value, context) => {
  if (new Set(value.manifest.map((entry) => entry.batchId)).size !== value.manifest.length)
    context.addIssue({ code: "custom", message: "Duplicate manifest entry." });
  if (new Set(value.sources.map((entry) => entry.source)).size !== value.sources.length)
    context.addIssue({ code: "custom", message: "Duplicate source status." });
  if (value.status === "SUCCEEDED" && value.sources.some((entry) => entry.status !== "COMPLETE" || entry.errorCode))
    context.addIssue({ code: "custom", message: "Incomplete sources cannot finalize as SUCCEEDED." });
});

export function addressInScope(ip: string, scope: Pick<ScopeInput, "cidrs" | "exclusions">) {
  return !scope.exclusions.includes(ip) && scope.cidrs.some((cidr) => {
    const network = parseIpv4Cidr(cidr);
    return !!network && ipv4InNetwork(ip, network);
  });
}

export type CollectorInput = z.infer<typeof collectorSchema>;
export type ScopeInput = z.infer<typeof scopeSchema>;
export type RunInput = z.infer<typeof createRunSchema>;
export type LeaseInput = z.infer<typeof leaseSchema>;
export type BatchInput = z.infer<typeof batchSchema>;
export type FinalizeInput = z.infer<typeof finalizeSchema>;
export type Observation = z.infer<typeof observationSchema>;
