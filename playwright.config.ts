import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4185', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1366, height: 768 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true } },
  ],
  webServer: {
    command: 'npm run start -- --hostname 127.0.0.1 --port 4185',
    url: 'http://127.0.0.1:4185',
    reuseExistingServer: false,
    timeout: 60_000,
    env: { OPENAI_API_KEY: '' },
  },
});
