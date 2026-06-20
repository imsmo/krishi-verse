// apps/mobile/jest.config.js · unit tests for the FRAMEWORK-FREE core logic (state machine, offline queue,
// pure helpers). React Native screens + native modules are exercised by the RN test runner in CI (jest-expo);
// this config deliberately scopes to src/core/__tests__ so the pure logic is verifiable anywhere, including the
// offline sandbox. ts-jest with isolatedModules (per-file transpile — no cross-file typecheck needed here).
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src/core/__tests__'],
  testMatch: ['**/*.spec.ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { isolatedModules: true }] },
};
