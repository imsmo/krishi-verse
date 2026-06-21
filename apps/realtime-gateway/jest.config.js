/** Jest config for the realtime-gateway. Unit tests cover the PURE security/backpressure logic + JWT verify
 *  (no ws/Redis I/O). isolatedModules keeps transpile fast and avoids needing a full type graph. */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.spec.ts'],
  globals: { 'ts-jest': { isolatedModules: true } },
};
