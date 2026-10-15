import { defineConfig, devices } from '@playwright/test'

const PORT = 5174
const BASE_URL = `http://localhost:${PORT}/`

// Runs against the Firebase emulators with a throwaway demo project (see
// .env.emulator), started by `npm run test:e2e:mumu` via emulators:exec.
// No real data or secrets involved.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  // Every test resets the one shared emulator, so they must run one at a time.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    // Cloud sessions ship a Chromium outside Playwright's own cache.
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  webServer: {
    command: `npx vite --mode emulator --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: 'iphone', use: { ...devices['iPhone 13'], browserName: 'chromium' } }],
})
