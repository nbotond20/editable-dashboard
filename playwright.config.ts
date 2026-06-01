import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:4174",
    trace: "on-first-retry",
    actionTimeout: 10_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 1200 } },
      testMatch: ["drag-test-cases.spec.ts", "keyboard-drag.spec.ts", "resize-test-cases.spec.ts", "lock-test-cases.spec.ts", "auto-scroll.spec.ts", "ghost-preview.spec.ts", "grab-position.spec.ts", "insertion-lines-render.spec.ts", "insertion-lines-magnetic.spec.ts", "insertion-lines-h-drop.spec.ts", "insertion-lines-v-drop.spec.ts", "insertion-lines-edge-cases.spec.ts", "insertion-lines-modes.spec.ts", "insertion-lines-disabled-bugs.spec.ts", "lines-mode-affordances.spec.ts", "lines-mode-source-alone-row.spec.ts", "lines-mode-invalid-feedback.spec.ts", "lines-mode-add-slot-cursor-hover.spec.ts", "lines-mode-endcap-stacking.spec.ts", "lines-mode-tall-source-line-alignment.spec.ts", "lines-mode-lower-row-trailing-slot.spec.ts", "lines-mode-empty-slot-grows.spec.ts"],
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
      testMatch: ["touch-drag.spec.ts"],
    },
    {
      name: "randomized",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 1200 } },
      testMatch: ["randomized/runner.spec.ts", "randomized/suite.spec.ts"],
    },
  ],
  webServer: {
    command: "pnpm dev --port 4174",
    url: "http://localhost:4174",
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
});
