// apps/api/jest.config.js
// Phase-1 scope: the fully-implemented `listings` vertical slice (+ shared core).
// `unit` runs everywhere (pure/mocked, no infra). `integration` needs a real
// Postgres (DATABASE_URL) and runs in the CI service-container job. As each
// further PRD module is implemented, add its path to the testMatch globs.
module.exports = {
  projects: [
    {
      displayName: 'unit',
      preset: 'ts-jest',
      testEnvironment: 'node',
      rootDir: 'src',
      testMatch: [
        '<rootDir>/modules/listings/__tests__/**/*.spec.ts',
        '<rootDir>/core/**/__tests__/**/*.spec.ts',
        '<rootDir>/shared/**/__tests__/**/*.spec.ts',
      ],
      testPathIgnorePatterns: ['\\.e2e-spec\\.ts$', '\\.integration\\.spec\\.ts$'],
    },
    {
      displayName: 'integration',
      preset: 'ts-jest',
      testEnvironment: 'node',
      rootDir: 'src',
      testMatch: ['<rootDir>/modules/listings/__tests__/**/*.integration.spec.ts'],
    },
  ],
};
