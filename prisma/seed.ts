import { PrismaPg } from "@prisma/adapter-pg";

import {
  generatePorts,
  type PortProfileDefinition,
} from "../src/domain/ports/generatePorts";
import {
  DeviceCategory,
  DeviceStatus,
  DrawingDocumentType,
  FloorMapSourceType,
  PrismaClient,
  ProjectCostCategory,
  ScenarioType,
  SpecStatus,
  ZoneType,
} from "../src/generated/prisma/client";
import { netgearDemoDevices, quoteModels } from "./quote-demo-data";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://pace:pace_dev_password@localhost:5432/pace_digital_twin?schema=public";
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const verifiedAt = new Date("2026-08-11T00:00:00.000Z");

export interface SeedModel {
  id: string;
  vendorCode: string;
  category: (typeof DeviceCategory)[keyof typeof DeviceCategory];
  sku: string;
  modelName: string;
  sourceUrl: string;
  formFactor: string;
  rackUnits: number | null;
  switchingCapacityGbps?: number;
  firewallGbps?: number;
  ipsGbps?: number;
  ngfwGbps?: number;
  tlsInspectionGbps?: number;
  supportsLacp?: boolean;
  supportsMlag?: boolean;
  supportsStacking?: boolean;
  supportsHa?: boolean;
  managementOs: string;
  metadataJson: Record<string, string | number | boolean>;
  unitPriceVnd?: number;
  priceVatRateBps?: number;
  pricingSource?: string;
  quotedAt?: Date;
  profiles: PortProfileDefinition[];
  specStatus?: (typeof SpecStatus)[keyof typeof SpecStatus];
}

const vendors = [
  {
    id: "vendor-fortinet",
    code: "FORTINET",
    name: "Fortinet",
    website: "https://www.fortinet.com",
  },
  {
    id: "vendor-sophos",
    code: "SOPHOS",
    name: "Sophos",
    website: "https://www.sophos.com",
  },
  {
    id: "vendor-cisco",
    code: "CISCO",
    name: "Cisco",
    website: "https://www.cisco.com",
  },
  {
    id: "vendor-netgear",
    code: "NETGEAR",
    name: "NETGEAR",
    website: "https://www.netgear.com",
  },
  {
    id: "vendor-mikrotik",
    code: "MIKROTIK",
    name: "MikroTik",
    website: "https://mikrotik.com",
  },
  {
    id: "vendor-maipu",
    code: "MAIPU",
    name: "Maipu",
    website: "https://www.maipu.com",
  },
  {
    id: "vendor-ubiquiti",
    code: "UBIQUITI",
    name: "Ubiquiti",
    website: "https://ui.com",
  },
  { id: "vendor-hikvision", code: "HIKVISION", name: "HIKVISION", website: "https://www.hikvision.com" },
  { id: "vendor-generic", code: "GENERIC", name: "Generic Endpoint", website: "https://pace.edu.vn" },
] as const;

const models: SeedModel[] = [
  {
    id: "model-generic-desktop-laptop", vendorCode: "GENERIC", category: DeviceCategory.DESKTOP_LAPTOP,
    sku: "ENDPOINT-DESKTOP-LAPTOP", modelName: "Desktop / Laptop network node", sourceUrl: "user-defined",
    formFactor: "Endpoint", rackUnits: null, managementOs: "User managed", metadataJson: { planningNode: true },
    specStatus: SpecStatus.USER_CONFIRMED,
    profiles: [{ portGroup: "NETWORK", count: 1, media: "RJ45", supportedSpeedsMbps: [100,1000], poeStandard: "NONE", roleHint: "DATA", breakoutCapable: false, namePrefix: "eth", startNumber: 1, sortOrder: 10 }],
  },
  {
    id: "model-generic-network-printer", vendorCode: "GENERIC", category: DeviceCategory.PRINTER,
    sku: "ENDPOINT-NETWORK-PRINTER", modelName: "Network printer node", sourceUrl: "user-defined",
    formFactor: "Endpoint", rackUnits: null, managementOs: "Embedded", metadataJson: { planningNode: true },
    specStatus: SpecStatus.USER_CONFIRMED,
    profiles: [{ portGroup: "NETWORK", count: 1, media: "RJ45", supportedSpeedsMbps: [10,100,1000], poeStandard: "NONE", roleHint: "DATA", breakoutCapable: false, namePrefix: "eth", startNumber: 1, sortOrder: 10 }],
  },
  {
    id: "model-fortigate-200g",
    vendorCode: "FORTINET",
    category: DeviceCategory.FIREWALL,
    sku: "FG-200G",
    modelName: "FortiGate 200G",
    sourceUrl:
      "https://www.fortinet.com/resources/data-sheets/fortigate-200g-series",
    formFactor: "1U",
    rackUnits: 1,
    supportsLacp: true,
    supportsHa: true,
    managementOs: "FortiOS",
    metadataJson: {
      verifiedScope:
        "Fixed front-panel interfaces; performance fields intentionally omitted pending reviewed data-sheet values",
    },
    profiles: [
      {
        portGroup: "MGMT_HA",
        count: 2,
        media: "RJ45",
        supportedSpeedsMbps: [10, 100, 1000],
        poeStandard: "NONE",
        roleHint: "MANAGEMENT",
        breakoutCapable: false,
        namePrefix: "mgmt-ha",
        startNumber: 1,
        sortOrder: 10,
      },
      {
        portGroup: "GE_RJ45",
        count: 8,
        media: "RJ45",
        supportedSpeedsMbps: [10, 100, 1000],
        poeStandard: "NONE",
        roleHint: "DATA",
        breakoutCapable: false,
        namePrefix: "port",
        startNumber: 1,
        sortOrder: 20,
      },
      {
        portGroup: "MGE_RJ45",
        count: 8,
        media: "RJ45",
        supportedSpeedsMbps: [100, 1000, 2500, 5000],
        poeStandard: "NONE",
        roleHint: "DATA",
        breakoutCapable: false,
        namePrefix: "port",
        startNumber: 9,
        sortOrder: 30,
      },
      {
        portGroup: "GE_SFP",
        count: 4,
        media: "SFP",
        supportedSpeedsMbps: [1000],
        poeStandard: "NONE",
        roleHint: "UPLINK",
        breakoutCapable: false,
        namePrefix: "port",
        startNumber: 17,
        sortOrder: 40,
      },
      {
        portGroup: "TEN_GE_SFP_PLUS",
        count: 8,
        media: "SFP_PLUS",
        supportedSpeedsMbps: [1000, 10000],
        poeStandard: "NONE",
        roleHint: "UPLINK",
        breakoutCapable: false,
        namePrefix: "x",
        startNumber: 1,
        sortOrder: 50,
      },
    ],
  },
  {
    id: "model-sophos-xgs3100",
    vendorCode: "SOPHOS",
    category: DeviceCategory.FIREWALL,
    sku: "XGS-3100",
    modelName: "XGS 3100",
    sourceUrl:
      "https://www.sophos.com/en-us/products/next-gen-firewall/xgs-1u-distributed-edge-firewalls",
    formFactor: "1U",
    rackUnits: 1,
    firewallGbps: 47,
    ipsGbps: 10.5,
    ngfwGbps: 9,
    tlsInspectionGbps: 2.47,
    supportsLacp: true,
    supportsHa: true,
    managementOs: "Sophos Firewall OS",
    metadataJson: { fixedPortCount: 12, maxPortDensityWithModules: 20 },
    unitPriceVnd: 166_730_000,
    pricingSource: "BG_THIET BI_TONG HOP_GiaiPhap_Netgear_X3100.pdf",
    quotedAt: new Date("2026-08-13T00:00:00.000+07:00"),
    profiles: [
      {
        portGroup: "GE_RJ45",
        count: 8,
        media: "RJ45",
        supportedSpeedsMbps: [10, 100, 1000],
        poeStandard: "NONE",
        roleHint: "DATA",
        breakoutCapable: false,
        namePrefix: "port",
        startNumber: 1,
        sortOrder: 10,
      },
      {
        portGroup: "TEN_GE_SFP_PLUS",
        count: 2,
        media: "SFP_PLUS",
        supportedSpeedsMbps: [1000, 10000],
        poeStandard: "NONE",
        roleHint: "UPLINK",
        breakoutCapable: false,
        namePrefix: "f",
        startNumber: 1,
        sortOrder: 20,
      },
      {
        portGroup: "GE_SFP",
        count: 2,
        media: "SFP",
        supportedSpeedsMbps: [1000],
        poeStandard: "NONE",
        roleHint: "UPLINK",
        breakoutCapable: false,
        namePrefix: "f",
        startNumber: 3,
        sortOrder: 30,
      },
    ],
  },
  {
    id: "model-cisco-c9300x-24y",
    vendorCode: "CISCO",
    category: DeviceCategory.CORE_SWITCH,
    sku: "C9300X-24Y",
    modelName: "Catalyst C9300X-24Y",
    sourceUrl:
      "https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-9300-series-switches/nb-06-cat9300-ser-data-sheet-cte-en.html",
    formFactor: "1U",
    rackUnits: 1,
    supportsLacp: true,
    supportsStacking: true,
    managementOs: "Cisco IOS XE",
    metadataJson: { modularUplinksExcluded: true },
    unitPriceVnd: 566_250_000,
    pricingSource: "BG_CISCO 25GB &XGS3100.pdf",
    quotedAt: new Date("2026-07-15T00:00:00.000+07:00"),
    profiles: [
      {
        portGroup: "SFP28_ACCESS",
        count: 24,
        media: "SFP28",
        supportedSpeedsMbps: [1000, 10000, 25000],
        poeStandard: "NONE",
        roleHint: "DATA",
        breakoutCapable: false,
        namePrefix: "twentyfiveGigE1/0/",
        startNumber: 1,
        sortOrder: 10,
      },
    ],
  },
  {
    id: "model-netgear-m4350-24f4v",
    vendorCode: "NETGEAR",
    category: DeviceCategory.CORE_SWITCH,
    sku: "XSM4328FV",
    modelName: "M4350-24F4V",
    sourceUrl:
      "https://www.downloads.netgear.com/files/GDC/M4350/M4350_HIG_EN.pdf",
    formFactor: "1U",
    rackUnits: 1,
    switchingCapacityGbps: 680,
    supportsLacp: true,
    supportsStacking: true,
    managementOs: "NETGEAR AV OS",
    metadataJson: { alternateSku: "M4350-24F4V" },
    unitPriceVnd: 155_670_000,
    pricingSource: "BG_THIET BI_TONG HOP_GiaiPhap_Netgear_X3100.pdf",
    quotedAt: new Date("2026-08-13T00:00:00.000+07:00"),
    profiles: [
      {
        portGroup: "SFP_PLUS",
        count: 24,
        media: "SFP_PLUS",
        supportedSpeedsMbps: [1000, 10000],
        poeStandard: "NONE",
        roleHint: "DATA",
        breakoutCapable: false,
        namePrefix: "port",
        startNumber: 1,
        sortOrder: 10,
      },
      {
        portGroup: "SFP28",
        count: 4,
        media: "SFP28",
        supportedSpeedsMbps: [1000, 10000, 25000],
        poeStandard: "NONE",
        roleHint: "UPLINK",
        breakoutCapable: false,
        namePrefix: "port",
        startNumber: 25,
        sortOrder: 20,
      },
    ],
  },
  {
    id: "model-mikrotik-crs518",
    vendorCode: "MIKROTIK",
    category: DeviceCategory.CORE_SWITCH,
    sku: "CRS518-16XS-2XQ-RM",
    modelName: "CRS518-16XS-2XQ-RM",
    sourceUrl: "https://mikrotik.com/product/crs518_16xs_2xq",
    formFactor: "1U",
    rackUnits: 1,
    switchingCapacityGbps: 1200,
    supportsLacp: true,
    supportsMlag: true,
    managementOs: "RouterOS v7 / SwOS",
    metadataJson: { managementEthernetMbps: 100 },
    unitPriceVnd: 41_250_000,
    pricingSource: "BG_MICROTIK&XGS3100.pdf",
    quotedAt: new Date("2026-07-24T00:00:00.000+07:00"),
    profiles: [
      {
        portGroup: "SFP28",
        count: 16,
        media: "SFP28",
        supportedSpeedsMbps: [1000, 10000, 25000],
        poeStandard: "NONE",
        roleHint: "DATA",
        breakoutCapable: false,
        namePrefix: "sfp28-",
        startNumber: 1,
        sortOrder: 10,
      },
      {
        portGroup: "QSFP28",
        count: 2,
        media: "QSFP28",
        supportedSpeedsMbps: [40000, 100000],
        poeStandard: "NONE",
        roleHint: "UPLINK",
        breakoutCapable: true,
        namePrefix: "qsfp28-",
        startNumber: 1,
        sortOrder: 20,
      },
      {
        portGroup: "MANAGEMENT",
        count: 1,
        media: "RJ45",
        supportedSpeedsMbps: [100],
        poeStandard: "NONE",
        roleHint: "MANAGEMENT",
        breakoutCapable: false,
        namePrefix: "ether",
        startNumber: 1,
        sortOrder: 30,
      },
    ],
  },
  ...quoteModels,
];

async function seedCatalog() {
  const vendorIds = new Map<string, string>();

  for (const vendor of vendors) {
    const stored = await prisma.vendor.upsert({
      where: { code: vendor.code },
      create: vendor,
      update: { name: vendor.name, website: vendor.website },
    });
    vendorIds.set(vendor.code, stored.id);
  }

  const storedModels = new Map<
    string,
    { id: string; profiles: PortProfileDefinition[] }
  >();

  for (const model of models) {
    const vendorId = vendorIds.get(model.vendorCode);
    if (!vendorId)
      throw new Error(`Missing seeded vendor ${model.vendorCode}.`);

    const fields = {
      vendorId,
      category: model.category,
      sku: model.sku,
      modelName: model.modelName,
      sourceUrl: model.sourceUrl,
      specStatus: model.specStatus ?? SpecStatus.VERIFIED_VENDOR,
      verifiedAt,
      formFactor: model.formFactor,
      rackUnits: model.rackUnits,
      switchingCapacityGbps: model.switchingCapacityGbps,
      firewallGbps: model.firewallGbps,
      ipsGbps: model.ipsGbps,
      ngfwGbps: model.ngfwGbps,
      tlsInspectionGbps: model.tlsInspectionGbps,
      supportsLacp: model.supportsLacp ?? false,
      supportsMlag: model.supportsMlag ?? false,
      supportsStacking: model.supportsStacking ?? false,
      supportsHa: model.supportsHa ?? false,
      managementOs: model.managementOs,
      metadataJson: model.metadataJson,
      isCustom: false,
      unitPriceVnd: model.unitPriceVnd,
      priceVatRateBps: model.priceVatRateBps ?? 800,
      pricingSource: model.pricingSource,
      quotedAt: model.quotedAt,
    };
    const stored = await prisma.deviceModel.upsert({
      where: { sku: model.sku },
      create: { id: model.id, ...fields },
      update: fields,
    });

    await prisma.portProfile.deleteMany({ where: { modelId: stored.id } });
    await prisma.portProfile.createMany({
      data: model.profiles.map((profile) => ({
        modelId: stored.id,
        ...profile,
      })),
    });
    storedModels.set(model.sku, { id: stored.id, profiles: model.profiles });
  }

  return storedModels;
}

async function seedLocations() {
  const campus = await prisma.campus.upsert({
    where: { code: "PACE-181" },
    create: {
      id: "campus-pace-181",
      code: "PACE-181",
      name: "PACE Smart Campus 181 Cô Giang",
      address: "181 Cô Giang, Phường Cầu Ông Lãnh, TP. Hồ Chí Minh",
      description:
        "Digital-twin demo data; verify against the live asset register before operational use.",
    },
    update: {
      name: "PACE Smart Campus 181 Cô Giang",
      address: "181 Cô Giang, Phường Cầu Ông Lãnh, TP. Hồ Chí Minh",
    },
  });
  const building = await prisma.building.upsert({
    where: { campusId_code: { campusId: campus.id, code: "VP181" } },
    create: {
      id: "building-vp181",
      campusId: campus.id,
      code: "VP181",
      name: "PACE 181 Cô Giang",
    },
    update: { name: "PACE 181 Cô Giang" },
  });

  const floorDefinitions = [
    { code: "B2", level: -2, name: "Basement 2" },
    { code: "B1", level: -1, name: "Basement 1" },
    ...Array.from({ length: 11 }, (_, index) => ({
      code: `T${index + 1}`,
      level: index + 1,
      name: `Tầng ${index + 1}`,
    })),
  ];
  let b2Id = "";
  const storedFloors: Array<{ id: string; code: string; name: string }> = [];

  for (const floor of floorDefinitions) {
    const stored = await prisma.floor.upsert({
      where: { buildingId_code: { buildingId: building.id, code: floor.code } },
      create: {
        id: `floor-vp181-${floor.code.toLowerCase()}`,
        buildingId: building.id,
        ...floor,
      },
      update: { level: floor.level, name: floor.name },
    });
    storedFloors.push({ id: stored.id, code: stored.code, name: stored.name });
    if (floor.code === "B2") b2Id = stored.id;
  }

  for (const floor of storedFloors) {
    const coordinateSystem = await prisma.spatialCoordinateSystem.upsert({
      where: { id: `coordinates-${floor.id}` },
      create: {
        id: `coordinates-${floor.id}`,
        floorId: floor.id,
        name: "Canonical floor coordinates",
      },
      update: { name: "Canonical floor coordinates" },
    });
    await prisma.floorMap.upsert({
      where: { id: `floor-map-${floor.id}` },
      create: {
        id: `floor-map-${floor.id}`,
        floorId: floor.id,
        name: `${floor.code} blank floor map`,
        purpose: DrawingDocumentType.FLOOR_PLAN,
        sourceType: FloorMapSourceType.MANUAL,
        isActive: true,
        coordinateSystemId: coordinateSystem.id,
      },
      update: {
        name: `${floor.code} blank floor map`,
        isActive: true,
        coordinateSystemId: coordinateSystem.id,
      },
    });
  }

  const zone = await prisma.zone.upsert({
    where: { floorId_code: { floorId: b2Id, code: "CORE-DC" } },
    create: {
      id: "zone-vp181-b2-core-dc",
      floorId: b2Id,
      code: "CORE-DC",
      name: "Core & Server Room",
      type: ZoneType.SERVER_ROOM,
    },
    update: { name: "Core & Server Room", type: ZoneType.SERVER_ROOM },
  });
  const rack = await prisma.rack.upsert({
    where: { zoneId_code: { zoneId: zone.id, code: "RACK-CORE-01" } },
    create: {
      id: "rack-vp181-core-01",
      zoneId: zone.id,
      code: "RACK-CORE-01",
      name: "Core Network Rack 01",
      rackUnits: 42,
    },
    update: { name: "Core Network Rack 01", rackUnits: 42 },
  });

  return {
    buildingId: building.id,
    floorId: b2Id,
    zoneId: zone.id,
    rackId: rack.id,
    floorIdsByCode: Object.fromEntries(
      storedFloors.map((floor) => [floor.code, floor.id]),
    ),
  };
}

async function seedScenariosAndDevices(
  location: Awaited<ReturnType<typeof seedLocations>>,
  catalog: Awaited<ReturnType<typeof seedCatalog>>,
) {
  const baseline = await prisma.scenario.upsert({
    where: { id: "scenario-baseline" },
    create: {
      id: "scenario-baseline",
      name: "Baseline",
      type: ScenarioType.BASELINE,
      isLocked: true,
      createdBy: "seed",
    },
    update: { name: "Baseline", isLocked: true },
  });
  const proposed = await prisma.scenario.upsert({
    where: { id: "scenario-proposed" },
    create: {
      id: "scenario-proposed",
      name: "Proposed Core Alternatives",
      type: ScenarioType.PROPOSED,
      parentScenarioId: baseline.id,
      isLocked: false,
      createdBy: "seed",
    },
    update: {
      name: "Proposed Core Alternatives",
      parentScenarioId: baseline.id,
    },
  });

  const quoteCostItems = [
    [
      "SOPHOS-SUPPORT-1Y",
      ProjectCostCategory.SOFTWARE,
      "Sophos XGS3100 Network Protection + Enhanced Support (1 year)",
      1,
      65_993_400,
      0,
    ],
    [
      "SFP-10G-LR",
      ProjectCostCategory.OPTICS,
      "Wintop 10G LR SFP+ 10 km",
      26,
      1_110_000,
      800,
    ],
    [
      "SFP-10G-SR",
      ProjectCostCategory.OPTICS,
      "Wintop 10G SR SFP+ 300 m",
      4,
      1_110_000,
      800,
    ],
    [
      "PATCH-SM-2M",
      ProjectCostCategory.CABLING,
      "Single-mode SC/UPC patch cord 2 m",
      26,
      50_000,
      800,
    ],
    [
      "PATCH-MM-2M",
      ProjectCostCategory.CABLING,
      "Multimode LC/UPC patch cord 2 m",
      5,
      96_000,
      800,
    ],
    [
      "ODF-24FO",
      ProjectCostCategory.ACCESSORY,
      "Fixed rack ODF 24FO SC/UPC",
      2,
      810_000,
      800,
    ],
    [
      "ODF-08FO",
      ProjectCostCategory.ACCESSORY,
      "Fixed rack ODF 08FO SC/UPC",
      4,
      590_000,
      800,
    ],
    [
      "PATCH-PANEL-CAT6",
      ProjectCostCategory.RACK,
      "AMPC 24-port CAT6 patch panel 1U",
      18,
      1_950_000,
      800,
    ],
    [
      "WALL-RACK-6U",
      ProjectCostCategory.RACK,
      "AMPC wall-mount rack 6U",
      10,
      2_700_000,
      800,
    ],
    [
      "RJ45-COMMSCOPE",
      ProjectCostCategory.CABLING,
      "CommScope CAT6 RJ45 plug",
      100,
      30_000,
      800,
    ],
    [
      "RJ45-DINTEK-BAG",
      ProjectCostCategory.CABLING,
      "DINTEK CAT6 modular plug bag",
      7,
      1_040_000,
      800,
    ],
    [
      "RJ45-BOOT-BAG",
      ProjectCostCategory.CABLING,
      "DINTEK yellow RJ45 boot bag",
      8,
      350_000,
      800,
    ],
    [
      "INSTALLATION",
      ProjectCostCategory.SERVICE,
      "Installation and device configuration",
      1,
      15_000_000,
      800,
    ],
  ] as const;
  for (const [
    code,
    category,
    description,
    quantity,
    unitCostVnd,
    vatRateBps,
  ] of quoteCostItems) {
    await prisma.projectCostItem.upsert({
      where: { scenarioId_code: { scenarioId: proposed.id, code } },
      create: {
        scenarioId: proposed.id,
        code,
        category,
        description,
        quantity,
        unitCostVnd,
        vatRateBps,
        source: "BG_THIET BI_TONG HOP_GiaiPhap_Netgear_X3100.pdf",
      },
      update: { category, description, quantity, unitCostVnd, vatRateBps },
    });
  }

  for (const scenario of [baseline, proposed]) {
    const baselineDefinitions = [
      {
        hostname: "FW-01",
        displayName: "Firewall 01",
        sku: "FG-200G",
        rackUnitStart: 40,
        floorCode: "B2",
      },
      {
        hostname: "FW-02",
        displayName: "Firewall 02",
        sku: "FG-200G",
        rackUnitStart: 39,
        floorCode: "B2",
      },
      {
        hostname: "CORE-01",
        displayName: "Core Switch 01",
        sku: "XSM4328FV",
        rackUnitStart: 37,
        floorCode: "B2",
      },
      {
        hostname: "CORE-02",
        displayName: "Core Switch 02",
        sku: "XSM4328FV",
        rackUnitStart: 36,
        floorCode: "B2",
      },
    ];
    const definitions =
      scenario.id === proposed.id ? netgearDemoDevices : baselineDefinitions;

    if (scenario.id === proposed.id) {
      await prisma.deviceInstance.deleteMany({
        where: {
          scenarioId: scenario.id,
          hostname: "FW-02",
          notes: {
            startsWith:
              "Seeded planning record; identifiers and operational status require user confirmation.",
          },
        },
      });
    }

    for (const definition of definitions) {
      const catalogModel = catalog.get(definition.sku);
      if (!catalogModel)
        throw new Error(`Missing seeded model ${definition.sku}.`);
      const floorId = location.floorIdsByCode[definition.floorCode];
      if (!floorId)
        throw new Error(`Missing seeded floor ${definition.floorCode}.`);
      const inCoreRack =
        definition.floorCode === "B2" &&
        (definition.hostname.startsWith("FW-") ||
          definition.hostname.startsWith("CORE-"));
      const rackUnitStart =
        "rackUnitStart" in definition ? definition.rackUnitStart : undefined;
      const device = await prisma.deviceInstance.upsert({
        where: {
          scenarioId_hostname: {
            scenarioId: scenario.id,
            hostname: definition.hostname,
          },
        },
        create: {
          scenarioId: scenario.id,
          hostname: definition.hostname,
          displayName: definition.displayName,
          modelId: catalogModel.id,
          status: DeviceStatus.PLANNED,
          buildingId: location.buildingId,
          floorId,
          zoneId: inCoreRack ? location.zoneId : null,
          rackId: inCoreRack ? location.rackId : null,
          rackUnitStart,
          notes:
            scenario.id === proposed.id
              ? "Seeded from the 2026-08-13 Netgear/Sophos/Maipu/UniFi quotation for demo planning; serials and installed status require confirmation."
              : "Seeded planning record; identifiers and operational status require user confirmation.",
        },
        update: {
          displayName: definition.displayName,
          modelId: catalogModel.id,
          buildingId: location.buildingId,
          floorId,
          zoneId: inCoreRack ? location.zoneId : null,
          rackId: inCoreRack ? location.rackId : null,
          rackUnitStart,
        },
      });

      const portCount = await prisma.port.count({
        where: { deviceInstanceId: device.id },
      });
      if (portCount === 0) {
        await prisma.port.createMany({
          data: generatePorts(catalogModel.profiles).map((port) => ({
            ...port,
            scenarioId: scenario.id,
            deviceInstanceId: device.id,
          })),
        });
      }
    }
  }
}

async function main() {
  const catalog = await seedCatalog();
  const location = await seedLocations();
  await seedScenariosAndDevices(location, catalog);
  console.log(
    "Seeded catalog alternatives and the 2026-08-13 Netgear quote demo inventory.",
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
