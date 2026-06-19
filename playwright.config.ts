import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  webServer: {
    command: "npm run build && npm start",
    url: "http://127.0.0.1:3000/api/health",
    reuseExistingServer: true,
    timeout: 30_000,
    env: {
      NODE_ENV: "test",
      APP_PORT: "3000",
      EXTERNAL_URL: "http://127.0.0.1:3000",
      DATABASE_URL: "file::memory:",
      SESSION_SECRET: "test-secret-test-secret-test-secret-123",
      ADMIN_INITIAL_PASSWORD: "AdminPass123!",
      DEFAULT_RATE_LIMIT_SECONDS: "1"
    }
  },
  use: {
    baseURL: "http://127.0.0.1:3000",
    browserName: "chromium",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  }
});
