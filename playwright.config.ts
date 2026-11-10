import { defineConfig, devices } from "@playwright/test";

const isContinuousIntegration = Boolean(process.env.CI);
const frontendPort = process.env.SHOPSENSE_FRONTEND_PORT ?? "5881";
const apiPort = process.env.SHOPSENSE_API_PORT ?? "5882";
const frontendUrl = `http://127.0.0.1:${frontendPort}`;
const apiUrl = `http://127.0.0.1:${apiPort}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: isContinuousIntegration,
  retries: isContinuousIntegration ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: frontendUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node src/main.mjs",
      cwd: "../shopsense-backend",
      url: `${apiUrl}/api/v1/health`,
      reuseExistingServer: false,
      timeout: 30_000,
      env: {
        PORT: apiPort,
        SHOPSENSE_DB_PATH: ":memory:",
        SHOPSENSE_ALLOWED_ORIGINS: frontendUrl,
      },
    },
    {
      command: `npx next start --hostname 127.0.0.1 --port ${frontendPort}`,
      url: frontendUrl,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
