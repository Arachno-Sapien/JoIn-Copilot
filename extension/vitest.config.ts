import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // tests/e2e holds Playwright specs; `npx playwright test` runs those.
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
  },
});
