import { describe, expect, it, vi } from "vitest";

import type {
  CatalogModelRecord,
  CatalogRepository,
} from "@/server/repositories/catalogRepository";
import {
  createCatalogModel,
  createVendor,
  deleteCatalogModel,
  getCatalogModel,
  listCatalog,
  updateCatalogModel,
} from "@/server/services/catalogService";

function model(overrides: Partial<CatalogModelRecord> = {}) {
  return {
    id: "model-1",
    isCustom: true,
    _count: { instances: 0 },
    portProfiles: [],
    ...overrides,
  } as unknown as CatalogModelRecord;
}

function repository(overrides: Partial<CatalogRepository> = {}) {
  return {
    list: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(model()),
    create: vi.fn().mockResolvedValue(model()),
    update: vi.fn().mockResolvedValue(model()),
    delete: vi.fn().mockResolvedValue(undefined),
    findVendorConflict: vi.fn().mockResolvedValue(null),
    createVendor: vi.fn().mockResolvedValue({ id: "vendor-new", code: "CISCO", name: "Cisco", website: null }),
    ...overrides,
  } as CatalogRepository;
}

const validInput = {
  vendorId: "vendor-1",
  category: "CORE_SWITCH",
  sku: " custom-24 ",
  modelName: "Custom 24",
  portProfiles: [
    {
      portGroup: "DEFAULT",
      count: 2,
      media: "SFP28",
      supportedSpeedsMbps: [10000, 25000],
      namePrefix: "port",
    },
  ],
};

describe("catalogService", () => {
  it("normalizes list search", async () => {
    const repo = repository();
    await listCatalog({ search: "  core  " }, repo);
    expect(repo.list).toHaveBeenCalledWith({ search: "core" });
  });

  it("returns a model or a typed not-found error", async () => {
    await expect(
      getCatalogModel("model-1", repository()),
    ).resolves.toMatchObject({ id: "model-1" });
    await expect(
      getCatalogModel(
        "missing",
        repository({ findById: vi.fn().mockResolvedValue(null) }),
      ),
    ).rejects.toMatchObject({ code: "MODEL_NOT_FOUND", status: 404 });
  });

  it("creates a USER_CONFIRMED custom model with validated profiles", async () => {
    const repo = repository();
    await createCatalogModel(validInput, repo);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        sku: "CUSTOM-24",
        isCustom: true,
        specStatus: "USER_CONFIRMED",
        vendor: { connect: { id: "vendor-1" } },
      }),
    );
  });

  it("rejects invalid create input", async () => {
    await expect(
      createCatalogModel({ ...validInput, portProfiles: [] }, repository()),
    ).rejects.toMatchObject({
      code: "INVALID_MODEL",
      status: 400,
    });
  });

  it("normalizes and creates a new vendor", async () => {
    const repo = repository();
    await createVendor({ code: " cisco ", name: " Cisco ", website: "" }, repo);
    expect(repo.findVendorConflict).toHaveBeenCalledWith("CISCO", "Cisco");
    expect(repo.createVendor).toHaveBeenCalledWith({ code: "CISCO", name: "Cisco", website: null });
  });

  it("rejects invalid and duplicate vendors", async () => {
    await expect(createVendor({ code: "bad code", name: "Vendor" }, repository())).rejects.toMatchObject({ code: "INVALID_VENDOR", status: 400 });
    const duplicateRepo = repository({
      findVendorConflict: vi.fn().mockResolvedValue({ id: "vendor-1", code: "CISCO", name: "Cisco" }),
    });
    await expect(createVendor({ code: "cisco", name: "Cisco Systems" }, duplicateRepo)).rejects.toMatchObject({ code: "VENDOR_CONFLICT", status: 409 });
  });

  it("updates only custom models", async () => {
    await expect(
      updateCatalogModel(
        "vendor",
        { modelName: "Changed" },
        repository({
          findById: vi.fn().mockResolvedValue(model({ isCustom: false })),
        }),
      ),
    ).rejects.toMatchObject({ code: "VENDOR_MODEL_READ_ONLY" });

    const repo = repository();
    await updateCatalogModel("model-1", { modelName: "Changed" }, repo);
    expect(repo.update).toHaveBeenCalledWith(
      "model-1",
      expect.objectContaining({
        modelName: "Changed",
        specStatus: "USER_CONFIRMED",
      }),
    );

    await expect(
      updateCatalogModel("model-1", { rackUnits: -1 }, repo),
    ).rejects.toMatchObject({ code: "INVALID_MODEL" });
  });

  it("deletes only unused custom models", async () => {
    const usedRepo = repository({
      findById: vi.fn().mockResolvedValue(model({ _count: { instances: 1 } })),
    });
    await expect(deleteCatalogModel("model-1", usedRepo)).rejects.toMatchObject(
      { code: "MODEL_IN_USE" },
    );

    const vendorRepo = repository({
      findById: vi.fn().mockResolvedValue(model({ isCustom: false })),
    });
    await expect(
      deleteCatalogModel("model-1", vendorRepo),
    ).rejects.toMatchObject({ code: "VENDOR_MODEL_READ_ONLY" });

    const repo = repository();
    await deleteCatalogModel("model-1", repo);
    expect(repo.delete).toHaveBeenCalledWith("model-1");
  });
});
