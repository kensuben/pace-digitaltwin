import { createHash, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { AppError } from "@/server/errors";

const principalSchema = z.strictObject({
  id: z.string().min(1).max(128),
  tokenSha256: z.string().regex(/^[a-f0-9]{64}$/),
  role: z.enum(["ADMIN", "EDITOR", "VIEWER", "COLLECTOR"]),
  campusIds: z.array(z.string().min(1)).min(1),
  collectorId: z.string().min(1).optional(),
}).refine((value) => (value.role === "COLLECTOR") === !!value.collectorId,
  "Only collector principals must have a collectorId.");
export type DiscoveryPrincipal = Omit<z.infer<typeof principalSchema>, "tokenSha256">;

export function authenticateDiscovery(request: Request, config = process.env.DISCOVERY_PRINCIPALS_JSON): DiscoveryPrincipal {
  if (process.env.DISCOVERY_ENABLED !== "true")
    throw new AppError("DISCOVERY_DISABLED", "Discovery is disabled.", 503);
  let principals: z.infer<typeof principalSchema>[];
  try {
    principals = z.array(principalSchema).min(1).parse(JSON.parse(config ?? "[]"));
    if (new Set(principals.map((p) => p.tokenSha256)).size !== principals.length ||
        new Set(principals.map((p) => p.id)).size !== principals.length)
      throw new Error("Duplicate principal.");
  } catch {
    throw new AppError("DISCOVERY_AUTH_UNCONFIGURED", "Discovery authentication is not configured.", 503);
  }
  const authorization = request.headers.get("authorization") ?? "";
  if (!/^Bearer [A-Za-z0-9_-]{32,256}$/.test(authorization))
    throw new AppError("UNAUTHENTICATED", "A Discovery access token is required.", 401);
  const digest = createHash("sha256").update(authorization.slice(7)).digest();
  const matched = principals.filter((p) => timingSafeEqual(digest, Buffer.from(p.tokenSha256, "hex")));
  if (matched.length !== 1)
    throw new AppError("UNAUTHENTICATED", "Invalid Discovery access token.", 401);
  const { tokenSha256: _tokenSha256, ...principal } = matched[0];
  void _tokenSha256;
  return principal;
}

export function requireDiscoveryRole(principal: DiscoveryPrincipal, roles: DiscoveryPrincipal["role"][]) {
  if (!roles.includes(principal.role))
    throw new AppError("FORBIDDEN", "This Discovery action is not permitted.", 403);
}

export function requireDiscoveryCampus(principal: DiscoveryPrincipal, campusId: string) {
  if (!principal.campusIds.includes(campusId))
    throw new AppError("FORBIDDEN", "Campus is outside your Discovery access scope.", 403);
}
