import { expect, test } from "@playwright/test";

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
