export interface Ipv4Network {
  canonicalCidr: string;
  network: number;
  broadcast: number;
  prefix: number;
}

export function ipv4ToNumber(value: string): number | null {
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    result = result * 256 + octet;
  }
  return result >>> 0;
}

export function numberToIpv4(value: number) {
  return [24, 16, 8, 0]
    .map((shift) => String((value >>> shift) & 255))
    .join(".");
}

export function parseIpv4Cidr(value: string): Ipv4Network | null {
  const [address, prefixText, extra] = value.trim().split("/");
  if (extra !== undefined || prefixText === undefined) return null;
  const ip = ipv4ToNumber(address ?? "");
  const prefix = Number(prefixText);
  if (ip === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32)
    return null;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const network = (ip & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  return {
    canonicalCidr: `${numberToIpv4(network)}/${prefix}`,
    network,
    broadcast,
    prefix,
  };
}

export function ipv4NetworksOverlap(a: Ipv4Network, b: Ipv4Network) {
  return a.network <= b.broadcast && b.network <= a.broadcast;
}

export function ipv4InNetwork(ip: string, network: Ipv4Network) {
  const value = ipv4ToNumber(ip);
  return (
    value !== null && value >= network.network && value <= network.broadcast
  );
}
