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
        '<rootDir>/modules/identity/__tests__/**/*.spec.ts',
        '<rootDir>/modules/catalogue/__tests__/**/*.spec.ts',
        '<rootDir>/modules/orders/__tests__/**/*.spec.ts',
        '<rootDir>/modules/payments/__tests__/**/*.spec.ts',
        '<rootDir>/modules/auctions/__tests__/**/*.spec.ts',
        '<rootDir>/modules/offers/__tests__/**/*.spec.ts',
        '<rootDir>/modules/requirements/__tests__/**/*.spec.ts',
        '<rootDir>/modules/logistics/__tests__/**/*.spec.ts',
        '<rootDir>/modules/reviews/__tests__/**/*.spec.ts',
        '<rootDir>/modules/disputes/__tests__/**/*.spec.ts',
        '<rootDir>/modules/promotions/__tests__/**/*.spec.ts',
        '<rootDir>/modules/memberships/__tests__/**/*.spec.ts',
        '<rootDir>/modules/tenancy/__tests__/**/*.spec.ts',
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
      // Build the test DB ONCE from the real db/migrations + seeds (single source of truth).
      globalSetup: '<rootDir>/../test/integration-global-setup.js',
      testMatch: ['<rootDir>/modules/listings/__tests__/**/*.integration.spec.ts', '<rootDir>/modules/identity/__tests__/**/*.integration.spec.ts', '<rootDir>/modules/catalogue/__tests__/**/*.integration.spec.ts', '<rootDir>/modules/orders/__tests__/**/*.integration.spec.ts', '<rootDir>/modules/payments/__tests__/**/*.integration.spec.ts', '<rootDir>/modules/auctions/__tests__/**/*.integration.spec.ts', '<rootDir>/modules/offers/__tests__/**/*.integration.spec.ts', '<rootDir>/modules/requirements/__tests__/**/*.integration.spec.ts', '<rootDir>/modules/logistics/__tests__/**/*.integration.spec.ts', '<rootDir>/modules/reviews/__tests__/**/*.integration.spec.ts', '<rootDir>/modules/disputes/__tests__/**/*.integration.spec.ts', '<rootDir>/modules/promotions/__tests__/**/*.integration.spec.ts', '<rootDir>/modules/memberships/__tests__/**/*.integration.spec.ts', '<rootDir>/modules/tenancy/__tests__/**/*.integration.spec.ts', '<rootDir>/core/**/__tests__/**/*.integration.spec.ts'],
    },
  ],
};
