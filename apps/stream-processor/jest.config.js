/** Jest config for the stream-processor. Unit tests cover the PURE core (topics, envelope, retry policy, fraud
 *  scoring) — no Kafka/pg I/O. isolatedModules keeps transpile fast without a full type graph. */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.spec.ts'],
  globals: { 'ts-jest': { isolatedModules: true } },
};
