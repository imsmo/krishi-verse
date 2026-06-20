// apps/admin-api/jest.config.js · unit + integration projects (mirrors apps/api). `unit` is pure/mocked (no
// infra); `integration` needs a real Postgres (DATABASE_URL / DATABASE_ADMIN_URL) and runs in CI's DB job.
module.exports = {
  projects: [
    {
      displayName: 'unit',
      preset: 'ts-jest',
      testEnvironment: 'node',
      rootDir: 'src',
      // Only the implemented modules' specs run. Add a module's path here as it's built (the other ops modules
      // are still scaffolds with no tests).
      testMatch: ['<rootDir>/modules/ai-models-ops/__tests__/**/*.spec.ts'],
      testPathIgnorePatterns: ['\\.integration\\.spec\\.ts$'],
    },
    {
      displayName: 'integration',
      preset: 'ts-jest',
      testEnvironment: 'node',
      rootDir: 'src',
      testMatch: ['<rootDir>/modules/ai-models-ops/__tests__/**/*.integration.spec.ts'],
    },
  ],
};
