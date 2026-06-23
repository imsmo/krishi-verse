// apps/web-storefront/jest.config.js · unit tests for the storefront's PURE logic (the framework-free modules in
// src/features/** + helpers). These have no React, no Next, no SDK runtime (type-only imports), so they run under
// ts-jest in a node env — fast and deterministic. Page/Server-Action behaviour is covered by CI's typecheck + the
// e2e suite; this config deliberately scopes to the pure modules. Mirrors packages/i18n's setup.
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { isolatedModules: true, tsconfig: { module: 'commonjs', moduleResolution: 'node', esModuleInterop: true, skipLibCheck: true, strict: true, jsx: 'preserve' } }],
  },
};
