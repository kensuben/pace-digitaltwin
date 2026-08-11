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
