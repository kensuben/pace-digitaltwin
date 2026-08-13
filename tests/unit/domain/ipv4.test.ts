import { describe, expect, it } from "vitest";

import {
  ipv4InNetwork,
  ipv4NetworksOverlap,
  ipv4ToNumber,
  parseIpv4Cidr,
} from "@/domain/network/ipv4";

describe("IPv4 network primitives", () => {
  it("parses and canonicalizes CIDR values", () => {
    expect(parseIpv4Cidr("10.20.30.44/24")).toMatchObject({
      canonicalCidr: "10.20.30.0/24",
      prefix: 24,
    });
    expect(parseIpv4Cidr("10.20.30.1/33")).toBeNull();
    expect(ipv4ToNumber("300.1.1.1")).toBeNull();
  });

  it("detects containment and overlapping networks", () => {
    const parent = parseIpv4Cidr("10.0.0.0/24")!;
    const child = parseIpv4Cidr("10.0.0.128/25")!;
    const other = parseIpv4Cidr("10.0.1.0/24")!;
    expect(ipv4InNetwork("10.0.0.254", parent)).toBe(true);
    expect(ipv4InNetwork("10.0.1.1", parent)).toBe(false);
    expect(ipv4NetworksOverlap(parent, child)).toBe(true);
    expect(ipv4NetworksOverlap(parent, other)).toBe(false);
  });
});
