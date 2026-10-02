import { defineConfig, devices } from "@playwright/test";

// Baseline suites exercise server execution; local-practice owns an enabled server.
process.env.VITE_LOCAL_PRACTICE_ENABLED ??= "false";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  workers: 2,
  timeout: 60_000,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5210",
    trace: "retain-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : undefined,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run dev -- --port 5210 --strictPort",
    url: "http://127.0.0.1:5210",
    reuseExistingServer: !process.env.CI,
  },
});
