// apps/web-admin/jest.config.js · unit tests for the console's PURE logic (the framework-free modules in
// src/features/** + helpers). No React, no Next, no fetch runtime (type-only imports) → ts-jest in a node env,
// fast + deterministic. Page/Server-Action behaviour is covered by CI typecheck; this scopes to pure modules.
// Mirrors web-tenant / web-storefront.
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { isolatedModules: true, tsconfig: { module: 'commonjs', moduleResolution: 'node', esModuleInterop: true, skipLibCheck: true, strict: true, jsx: 'preserve' } }],
  },
};
