import type { PortProfileDefinition } from "../src/domain/ports/generatePorts";
import { DeviceCategory } from "../src/generated/prisma/client";
import type { SeedModel } from "./seed";

const quoteSource = {
  netgear: "BG_THIET BI_TONG HOP_GiaiPhap_Netgear_X3100.pdf (2026-08-13)",
  mikrotik: "BG_MICROTIK&XGS3100.pdf (2026-07-24)",
  cisco: "BG_CISCO 25GB &XGS3100.pdf (2026-07-15)",
  camera: "BG_CAMERA_Ngay 24.07.2026.pdf (2026-07-24)",
};

function profile(
  portGroup: string,
  count: number,
  media: PortProfileDefinition["media"],
  supportedSpeedsMbps: number[],
  namePrefix: string,
  sortOrder: number,
  poeStandard: PortProfileDefinition["poeStandard"] = "NONE",
  roleHint: PortProfileDefinition["roleHint"] = "DATA",
): PortProfileDefinition {
  return {
    portGroup,
    count,
    media,
    supportedSpeedsMbps,
    poeStandard,
    roleHint,
    breakoutCapable: false,
    namePrefix,
    startNumber: 1,
    sortOrder,
  };
}

function accessModel(input: {
  id: string;
  vendorCode: string;
  sku: string;
  modelName: string;
  sourceUrl: string;
  quote: string;
  rj45: number;
  uplinks: number;
  uplinkMedia: "SFP" | "SFP_PLUS";
  uplinkSpeeds: number[];
  switchingCapacityGbps?: number;
  poe?: "POE_PLUS";
  unitPriceVnd: number;
}): SeedModel {
  return {
    id: input.id,
    vendorCode: input.vendorCode,
    category: DeviceCategory.ACCESS_SWITCH,
    sku: input.sku,
    modelName: input.modelName,
    sourceUrl: input.sourceUrl,
    formFactor: "1U",
    rackUnits: 1,
    switchingCapacityGbps: input.switchingCapacityGbps,
    supportsLacp: true,
    managementOs:
      input.vendorCode === "CISCO"
        ? "Cisco Business Dashboard"
        : input.vendorCode === "MIKROTIK"
          ? "RouterOS v7 / SwOS"
          : input.vendorCode === "MAIPU"
            ? "Maipu MMC / CLI"
            : "NETGEAR Smart Managed",
    metadataJson: { quoteSource: input.quote, quoteCandidate: true },
    unitPriceVnd: input.unitPriceVnd,
    pricingSource: input.quote,
    quotedAt: new Date(
      input.quote === quoteSource.netgear
        ? "2026-08-13T00:00:00.000+07:00"
        : input.quote === quoteSource.mikrotik
          ? "2026-07-24T00:00:00.000+07:00"
          : "2026-07-15T00:00:00.000+07:00",
    ),
    profiles: [
      profile(
        "GE_RJ45",
        input.rj45,
        "RJ45",
        [10, 100, 1000],
        "port",
        10,
        input.poe ?? "NONE",
      ),
      profile(
        "UPLINK",
        input.uplinks,
        input.uplinkMedia,
        input.uplinkSpeeds,
        "uplink",
        20,
        "NONE",
        "UPLINK",
      ),
    ],
  };
}

const ciscoSource =
  "https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-1300-series-switches/nb-06-cat1300-ser-data-sheet-cte-en.html";

export const quoteModels: SeedModel[] = [
  {
    id: "model-hikvision-he-2n5d43a2-lmv2", vendorCode: "HIKVISION", category: DeviceCategory.CAMERA,
    sku: "HE-2N5D43A2-LMV2", modelName: "Camera IP bán cầu 4MP 2.8mm",
    sourceUrl: "BG_CAMERA_Ngay 24.07.2026.pdf", formFactor: "Dome", rackUnits: null,
    managementOs: "Hikvision", metadataJson: { quoteSource: quoteSource.camera, quotedQuantity: 20, resolutionMp: 4, infraredMeters: 30, microphone: true },
    unitPriceVnd: 1_890_000, pricingSource: quoteSource.camera, quotedAt: new Date("2026-07-24T00:00:00.000+07:00"), specStatus: "USER_CONFIRMED",
    profiles: [profile("NETWORK_POE",1,"RJ45",[10,100],"eth",10,"POE","DATA")],
  },
  {
    id: "model-hikvision-he-2n5t43a2-lmv2", vendorCode: "HIKVISION", category: DeviceCategory.CAMERA,
    sku: "HE-2N5T43A2-LMV2", modelName: "Camera IP trụ 4MP 4mm",
    sourceUrl: "BG_CAMERA_Ngay 24.07.2026.pdf", formFactor: "Bullet", rackUnits: null,
    managementOs: "Hikvision", metadataJson: { quoteSource: quoteSource.camera, quotedQuantity: 5, resolutionMp: 4, infraredMeters: 30, microphone: true },
    unitPriceVnd: 1_890_000, pricingSource: quoteSource.camera, quotedAt: new Date("2026-07-24T00:00:00.000+07:00"), specStatus: "USER_CONFIRMED",
    profiles: [profile("NETWORK_POE",1,"RJ45",[10,100],"eth",10,"POE","DATA")],
  },
  accessModel({
    id: "model-netgear-gs728txv3",
    vendorCode: "NETGEAR",
    sku: "GS728TXv3",
    modelName: "GS728TXv3",
    sourceUrl:
      "https://www.downloads.netgear.com/files/GDC/S3400_Switches/GS728TXv3_GS728TXUPv3_GS752TXv3_GS752TXUPv3_DS.pdf",
    quote: quoteSource.netgear,
    rj45: 24,
    uplinks: 4,
    uplinkMedia: "SFP_PLUS",
    uplinkSpeeds: [1000, 10000],
    switchingCapacityGbps: 128,
    unitPriceVnd: 15_080_000,
  }),
  accessModel({
    id: "model-netgear-gs752txv3",
    vendorCode: "NETGEAR",
    sku: "GS752TXv3",
    modelName: "GS752TXv3",
    sourceUrl:
      "https://www.netgear.com/business/wired/switches/smart-cloud/gs752txv3/",
    quote: quoteSource.netgear,
    rj45: 48,
    uplinks: 4,
    uplinkMedia: "SFP_PLUS",
    uplinkSpeeds: [1000, 10000],
    switchingCapacityGbps: 176,
    unitPriceVnd: 31_500_000,
  }),
  accessModel({
    id: "model-mikrotik-crs326",
    vendorCode: "MIKROTIK",
    sku: "CRS326-24G-2S+RM",
    modelName: "CRS326-24G-2S+RM",
    sourceUrl: "https://mikrotik.com/product/CRS326-24G-2SplusRM",
    quote: quoteSource.mikrotik,
    rj45: 24,
    uplinks: 2,
    uplinkMedia: "SFP_PLUS",
    uplinkSpeeds: [1000, 10000],
    unitPriceVnd: 5_720_000,
  }),
  {
    ...accessModel({
      id: "model-mikrotik-crs354",
      vendorCode: "MIKROTIK",
      sku: "CRS354-48G-4S+2Q+RM",
      modelName: "CRS354-48G-4S+2Q+RM",
      sourceUrl: "https://mikrotik.com/product/crs354_48g_4splus2qplusrm",
      quote: quoteSource.mikrotik,
      rj45: 48,
      uplinks: 4,
      uplinkMedia: "SFP_PLUS",
      uplinkSpeeds: [1000, 10000],
      unitPriceVnd: 13_780_000,
    }),
    profiles: [
      profile("GE_RJ45", 48, "RJ45", [10, 100, 1000], "ether", 10),
      profile(
        "SFP_PLUS",
        4,
        "SFP_PLUS",
        [1000, 10000],
        "sfp-sfpplus",
        20,
        "NONE",
        "UPLINK",
      ),
      profile(
        "QSFP_PLUS",
        2,
        "QSFP28",
        [40000],
        "qsfpplus",
        30,
        "NONE",
        "UPLINK",
      ),
    ],
  },
  accessModel({
    id: "model-maipu-is230-10tp-ac",
    vendorCode: "MAIPU",
    sku: "IS230-10TP-AC",
    modelName: "IS230-10TP-AC",
    sourceUrl: "https://www.maipu.com/Goods/Details/1108",
    quote: `${quoteSource.netgear}; ${quoteSource.mikrotik}; ${quoteSource.cisco}`,
    rj45: 8,
    uplinks: 2,
    uplinkMedia: "SFP",
    uplinkSpeeds: [1000],
    switchingCapacityGbps: 20,
    poe: "POE_PLUS",
    unitPriceVnd: 4_890_000,
  }),
  accessModel({
    id: "model-cisco-c1300-24t-4x",
    vendorCode: "CISCO",
    sku: "C1300-24T-4X",
    modelName: "Catalyst C1300-24T-4X",
    sourceUrl: ciscoSource,
    quote: quoteSource.cisco,
    rj45: 24,
    uplinks: 4,
    uplinkMedia: "SFP_PLUS",
    uplinkSpeeds: [1000, 10000],
    unitPriceVnd: 29_250_000,
  }),
  accessModel({
    id: "model-cisco-c1300-48t-4x",
    vendorCode: "CISCO",
    sku: "C1300-48T-4X",
    modelName: "Catalyst C1300-48T-4X",
    sourceUrl: ciscoSource,
    quote: quoteSource.cisco,
    rj45: 48,
    uplinks: 4,
    uplinkMedia: "SFP_PLUS",
    uplinkSpeeds: [1000, 10000],
    unitPriceVnd: 45_830_000,
  }),
  accessModel({
    id: "model-cisco-c1300-16t-2g",
    vendorCode: "CISCO",
    sku: "C1300-16T-2G",
    modelName: "Catalyst C1300-16T-2G",
    sourceUrl: ciscoSource,
    quote: quoteSource.cisco,
    rj45: 16,
    uplinks: 2,
    uplinkMedia: "SFP",
    uplinkSpeeds: [1000],
    unitPriceVnd: 14_630_000,
  }),
  accessModel({
    id: "model-cisco-c1300-16p-4x",
    vendorCode: "CISCO",
    sku: "C1300-16P-4X",
    modelName: "Catalyst C1300-16P-4X",
    sourceUrl: ciscoSource,
    quote: quoteSource.cisco,
    rj45: 16,
    uplinks: 4,
    uplinkMedia: "SFP_PLUS",
    uplinkSpeeds: [1000, 10000],
    poe: "POE_PLUS",
    unitPriceVnd: 22_750_000,
  }),
  {
    id: "model-ubiquiti-u7-pro",
    vendorCode: "UBIQUITI",
    category: DeviceCategory.AP,
    sku: "U7-Pro",
    modelName: "UniFi U7 Pro",
    sourceUrl: "https://techspecs.ui.com/unifi/wifi/u7-pro",
    formFactor: "Ceiling mount",
    rackUnits: null,
    supportsLacp: false,
    managementOs: "UniFi Network",
    metadataJson: {
      quoteSource: quoteSource.netgear,
      quoteCandidate: true,
      wifiStandard: "WiFi 7",
      spatialStreams: 6,
      powerMethod: "PoE+",
    },
    unitPriceVnd: 7_360_000,
    pricingSource: quoteSource.netgear,
    quotedAt: new Date("2026-08-13T00:00:00.000+07:00"),
    profiles: [
      profile(
        "MGE_POE_PLUS",
        1,
        "RJ45",
        [100, 1000, 2500],
        "eth",
        10,
        "POE_PLUS",
        "UPLINK",
      ),
    ],
  },
];

export const netgearDemoDevices = [
  {
    hostname: "FW-01",
    displayName: "Sophos Firewall",
    sku: "XGS-3100",
    floorCode: "B2",
    rackUnitStart: 40,
  },
  {
    hostname: "CORE-01",
    displayName: "Netgear Core 01",
    sku: "XSM4328FV",
    floorCode: "B2",
    rackUnitStart: 37,
  },
  {
    hostname: "CORE-02",
    displayName: "Netgear Core 02",
    sku: "XSM4328FV",
    floorCode: "B2",
    rackUnitStart: 36,
  },
  ...Array.from({ length: 10 }, (_, index) => ({
    hostname: `ACC-${String(index + 1).padStart(2, "0")}`,
    displayName: `Netgear Access ${index + 1}`,
    sku: "GS728TXv3",
    floorCode: `T${index + 1}`,
  })),
  {
    hostname: "ACC-48-01",
    displayName: "Netgear 48-port Access",
    sku: "GS752TXv3",
    floorCode: "T11",
  },
  ...Array.from({ length: 12 }, (_, index) => ({
    hostname: `POE-${String(index + 1).padStart(2, "0")}`,
    displayName: `Maipu PoE ${index + 1}`,
    sku: "IS230-10TP-AC",
    floorCode: index === 0 ? "B2" : `T${index}`,
  })),
  ...Array.from({ length: 24 }, (_, index) => ({
    hostname: `AP-${String(index + 1).padStart(2, "0")}`,
    displayName: `UniFi U7 Pro ${index + 1}`,
    sku: "U7-Pro",
    floorCode: `T${(index % 11) + 1}`,
  })),
] as const;
