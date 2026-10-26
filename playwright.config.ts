import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
  },
  projects: [
    { name: "mobile", use: { viewport: { width: 320, height: 850 } } },
    { name: "desktop", use: { viewport: { width: 1280, height: 900 } } },
  ],
});
