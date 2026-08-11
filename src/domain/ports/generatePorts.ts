export interface PortProfileDefinition {
  portGroup: string;
  count: number;
  media: "RJ45" | "SFP" | "SFP_PLUS" | "SFP28" | "QSFP28";
  supportedSpeedsMbps: number[];
  poeStandard: "NONE" | "POE" | "POE_PLUS" | "POE_PLUS_PLUS";
  roleHint:
    "MANAGEMENT" | "DATA" | "UPLINK" | "WAN" | "HA" | "CONSOLE" | "OTHER";
  breakoutCapable: boolean;
  namePrefix: string;
  startNumber: number;
  sortOrder: number;
}

export interface GeneratedPort {
  name: string;
  index: number;
  media: PortProfileDefinition["media"];
  supportedSpeedsMbps: number[];
  poeStandard: PortProfileDefinition["poeStandard"];
  roleHint: PortProfileDefinition["roleHint"];
  breakoutCapable: boolean;
}

export function generatePorts(
  profiles: readonly PortProfileDefinition[],
): GeneratedPort[] {
  const sortedProfiles = [...profiles].sort(
    (left, right) =>
      left.sortOrder - right.sortOrder ||
      left.portGroup.localeCompare(right.portGroup),
  );
  const names = new Set<string>();
  const ports: GeneratedPort[] = [];

  for (const profile of sortedProfiles) {
    if (!Number.isInteger(profile.count) || profile.count <= 0) {
      throw new Error(
        `Port profile ${profile.portGroup} must have a positive count.`,
      );
    }

    if (!Number.isInteger(profile.startNumber) || profile.startNumber < 0) {
      throw new Error(
        `Port profile ${profile.portGroup} must have a non-negative start number.`,
      );
    }

    for (let offset = 0; offset < profile.count; offset += 1) {
      const name = `${profile.namePrefix}${profile.startNumber + offset}`;

      if (names.has(name)) {
        throw new Error(`Generated duplicate port name: ${name}.`);
      }

      names.add(name);
      ports.push({
        name,
        index: ports.length + 1,
        media: profile.media,
        supportedSpeedsMbps: [...profile.supportedSpeedsMbps].sort(
          (left, right) => left - right,
        ),
        poeStandard: profile.poeStandard,
        roleHint: profile.roleHint,
        breakoutCapable: profile.breakoutCapable,
      });
    }
  }

  return ports;
}
