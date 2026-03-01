import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 1,
  workers: 1,
  reporter: [
    ['list'],
    ['json', { outputFile: 'e2e-results/results.json' }],
    ['html', { outputFolder: 'e2e-results/html', open: 'never' }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    screenshot: 'on',
    video: 'off',
    trace: 'off',
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
