// apps/wallet-service/jest.config.js · unit (pure/mocked, offline) + integration (real Postgres) projects.
// The unit project covers the ledger ENGINE invariants + striping with no infra; integration needs DATABASE_URL.
module.exports = {
  projects: [
    { displayName: 'unit', preset: 'ts-jest', testEnvironment: 'node', rootDir: 'src',
      setupFiles: ['<rootDir>/test/jest.setup.ts'],
      testMatch: ['<rootDir>/test/**/*.spec.ts'], testPathIgnorePatterns: ['\\.integration\\.spec\\.ts$', 'jest\\.setup\\.ts$'] },
    { displayName: 'integration', preset: 'ts-jest', testEnvironment: 'node', rootDir: 'src',
      testMatch: ['<rootDir>/test/**/*.integration.spec.ts'] },
  ],
};
