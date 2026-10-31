// Browser suite for the public site. Local by default: a static server on :4102 that mimics
// firebase.json (redirects, cleanUrls, trailingSlash, rewrites, headers, 404.html).
// Live, read-only:  BASE_URL=https://suvarnatantu.com npx playwright test
import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4102';
const live = !/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(BASE_URL);

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.mjs',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // Live runs stay gentle on production: at most 2 workers (1 by default).
  workers: live ? Number(process.env.LIVE_WORKERS || 1) : (process.env.CI ? 2 : 3),
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'test-results/results.json' }]] : [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    baseURL: BASE_URL,
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-375', use: { ...devices['Pixel 5'], viewport: { width: 375, height: 812 } } },
  ],
  webServer: live ? undefined : {
    command: 'node tests/e2e/static-server.mjs 4102',
    url: 'http://127.0.0.1:4102/',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
