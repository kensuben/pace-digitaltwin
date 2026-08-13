import { expect, test } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function minimalPdf() {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 100] /Contents 4 0 R >>",
    "<< /Length 0 >>\nstream\n\nendstream",
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body);
}

test("renders the M0 foundation page", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Network Digital Twin" }),
  ).toBeVisible();
});

test("exposes a liveness endpoint", async ({ request }) => {
  const response = await request.get("/api/health/live");
  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toMatchObject({
    data: { service: "pace-digitaltwin", status: "ok" },
    errors: [],
  });
});

test("renders seeded M1 inventory and catalog", async ({ page }) => {
  await page.goto("/inventory?scenarioId=scenario-proposed");
  await expect(page.getByRole("heading", { name: "Inventory" })).toBeVisible();
  await expect(page.getByRole("link", { name: "CORE-01" })).toBeVisible();

  await page.goto("/catalog");
  await expect(
    page.getByRole("heading", { name: "Device Catalog" }),
  ).toBeVisible();
  await expect(
    page.getByText("M4350-24F4V", { exact: true }).first(),
  ).toBeVisible();
});

test("creates generated ports and enforces scenario isolation", async ({
  request,
}) => {
  const hostname = `E2E-M1-${Date.now()}`;
  const created = await request.post("/api/inventory", {
    data: {
      scenarioId: "scenario-proposed",
      hostname,
      displayName: "E2E M1 Device",
      modelId: "model-netgear-m4350-24f4v",
      buildingId: "building-vp181",
      floorId: "floor-vp181-b2",
      zoneId: "zone-vp181-b2-core-dc",
      rackId: "rack-vp181-core-01",
    },
  });
  expect(created.status()).toBe(201);
  const body = (await created.json()) as {
    data: { id: string; ports: unknown[] };
  };
  expect(body.data.ports).toHaveLength(28);

  const crossScenario = await request.get(
    `/api/inventory/${body.data.id}?scenarioId=scenario-baseline`,
  );
  expect(crossScenario.status()).toBe(404);

  const updated = await request.patch(
    `/api/inventory/${body.data.id}?scenarioId=scenario-proposed`,
    { data: { status: "ACTIVE" } },
  );
  expect(updated.ok()).toBe(true);

  const deleted = await request.delete(
    `/api/inventory/${body.data.id}?scenarioId=scenario-proposed`,
  );
  expect(deleted.ok()).toBe(true);
});

test("creates, updates and deletes SP-0 drawing metadata", async ({
  request,
}) => {
  const created = await request.post("/api/drawings", {
    data: {
      campusId: "campus-pace-181",
      buildingId: "building-vp181",
      name: `E2E floor plan ${Date.now()}`,
      documentType: "FLOOR_PLAN",
      uploadedBy: "e2e",
    },
  });
  expect(created.status()).toBe(201);
  const body = (await created.json()) as {
    data: { id: string; status: string };
  };
  expect(body.data.status).toBe("UPLOADING");

  const updated = await request.patch(`/api/drawings/${body.data.id}`, {
    data: { name: "E2E updated floor plan" },
  });
  expect(updated.ok()).toBe(true);

  const deleted = await request.delete(`/api/drawings/${body.data.id}`);
  expect(deleted.ok()).toBe(true);
});

test("persists a port-first M2 topology link", async ({ page, request }) => {
  const inventoryResponse = await request.get(
    "/api/inventory?scenarioId=scenario-proposed",
  );
  const inventory = (await inventoryResponse.json()) as {
    data: Array<{ id: string; hostname: string }>;
  };
  const source = inventory.data.find((device) => device.hostname === "CORE-01");
  const target = inventory.data.find((device) => device.hostname === "CORE-02");
  expect(source).toBeTruthy();
  expect(target).toBeTruthy();

  const [sourceResponse, targetResponse] = await Promise.all([
    request.get(`/api/inventory/${source?.id}?scenarioId=scenario-proposed`),
    request.get(`/api/inventory/${target?.id}?scenarioId=scenario-proposed`),
  ]);
  const sourceDevice = (await sourceResponse.json()) as {
    data: { ports: Array<{ id: string; supportedSpeedsMbps: number[] }> };
  };
  const targetDevice = (await targetResponse.json()) as {
    data: { ports: Array<{ id: string; supportedSpeedsMbps: number[] }> };
  };
  const sourcePort = sourceDevice.data.ports.find((port) =>
    port.supportedSpeedsMbps.includes(10000),
  );
  const targetPort = targetDevice.data.ports.find((port) =>
    port.supportedSpeedsMbps.includes(10000),
  );
  expect(sourcePort).toBeTruthy();
  expect(targetPort).toBeTruthy();

  const created = await request.post("/api/links", {
    data: {
      scenarioId: "scenario-proposed",
      sourcePortId: sourcePort?.id,
      targetPortId: targetPort?.id,
      linkType: "FIBER",
      speedMbps: 10000,
      cableLabel: "E2E-M2",
    },
  });
  expect(created.status()).toBe(201);
  const createdBody = (await created.json()) as { data: { id: string } };

  const topology = await request.get(
    "/api/scenarios/scenario-proposed/topology",
  );
  await expect(topology.json()).resolves.toMatchObject({
    data: { links: [{ id: createdBody.data.id, cableLabel: "E2E-M2" }] },
  });

  await page.goto("/topology/scenario-proposed");
  await expect(
    page.getByRole("heading", { name: "Proposed Core Alternatives" }),
  ).toBeVisible();
  await expect(page.getByText("1 physical links")).toBeVisible();

  const updated = await request.patch(
    `/api/links/${createdBody.data.id}?scenarioId=scenario-proposed`,
    {
      data: {
        sourcePortId: sourcePort?.id,
        targetPortId: targetPort?.id,
        linkType: "FIBER",
        speedMbps: 10000,
        status: "ACTIVE",
        cableLabel: "E2E-M2-ACTIVE",
      },
    },
  );
  expect(updated.ok()).toBe(true);

  const deleted = await request.delete(
    `/api/links/${createdBody.data.id}?scenarioId=scenario-proposed`,
  );
  expect(deleted.ok()).toBe(true);
});

test("previews M4 model swap and persists validation findings", async ({
  request,
}) => {
  const inventoryResponse = await request.get(
    "/api/inventory?scenarioId=scenario-proposed",
  );
  const inventory = (await inventoryResponse.json()) as {
    data: Array<{ id: string; hostname: string; model: { id: string } }>;
  };
  const core = inventory.data.find((device) => device.hostname === "CORE-01");
  expect(core).toBeTruthy();

  const optionsResponse = await request.get("/api/catalog");
  const options = (await optionsResponse.json()) as {
    data: Array<{ id: string; category: string }>;
  };
  const target = options.data.find(
    (model) => model.category === "CORE_SWITCH" && model.id !== core?.model.id,
  );
  expect(target).toBeTruthy();

  const preview = await request.post(
    `/api/devices/${core?.id}/swap-model/preview`,
    {
      data: {
        scenarioId: "scenario-proposed",
        targetModelId: target?.id,
      },
    },
  );
  expect(preview.ok()).toBe(true);
  await expect(preview.json()).resolves.toMatchObject({
    data: { summary: { currentPortCount: expect.any(Number) } },
  });

  const validation = await request.post(
    "/api/scenarios/scenario-proposed/validate",
  );
  expect(validation.ok()).toBe(true);
  const findings = await request.get(
    "/api/scenarios/scenario-proposed/validation",
  );
  expect(findings.ok()).toBe(true);
  await expect(findings.json()).resolves.toMatchObject({
    data: expect.any(Array),
  });
});

test("uploads, processes and maps an SP-1 PDF page", async ({ request }) => {
  const created = await request.post("/api/drawings", {
    data: {
      campusId: "campus-pace-181",
      buildingId: "building-vp181",
      name: `E2E PDF ${Date.now()}`,
      documentType: "FLOOR_PLAN",
      uploadedBy: "e2e",
    },
  });
  const drawing = (await created.json()) as { data: { id: string } };
  const uploaded = await request.post(
    `/api/drawings/${drawing.data.id}/revisions`,
    {
      multipart: {
        revisionCode: "R1",
        file: {
          name: "e2e-floor.pdf",
          mimeType: "application/pdf",
          buffer: minimalPdf(),
        },
      },
    },
  );
  expect(uploaded.status()).toBe(201);

  await execFileAsync("npm", ["run", "worker:pdf:once"], {
    env: process.env,
  });
  const detail = await request.get(`/api/drawings/${drawing.data.id}`);
  const detailBody = (await detail.json()) as {
    data: { status: string; pageCount: number; pages: Array<{ id: string }> };
  };
  expect(detailBody.data).toMatchObject({
    status: "NEEDS_MAPPING",
    pageCount: 1,
  });
  const pageId = detailBody.data.pages[0]?.id;
  expect(pageId).toBeTruthy();
  const preview = await request.get(
    `/api/drawing-pages/${pageId}/asset?variant=thumbnail`,
  );
  expect(preview.headers()["content-type"]).toBe("image/webp");
  const mapped = await request.patch(`/api/drawing-pages/${pageId}`, {
    data: {
      buildingId: "building-vp181",
      floorId: "floor-vp181-t1",
    },
  });
  expect(mapped.ok()).toBe(true);
});
