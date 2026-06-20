// apps/wallet-service/src/test/jest.setup.ts · the ledger speaks bigint everywhere (Law 2). jest-worker
// serializes results across the worker boundary with JSON, which throws on a raw BigInt. Teaching BigInt to
// serialize as its decimal string (test-only) lets failure diffs / mock.calls containing bigint render instead
// of crashing the suite. Not loaded outside tests.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function (this: bigint) { return this.toString(); };
export {};
