import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100/api/health/live",
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgresql://pace:pace_dev_password@127.0.0.1:5432/pace_digital_twin?schema=public",
      DEMO_MODE: process.env.DEMO_MODE ?? "true",
    },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
