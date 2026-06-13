// core/idempotency/idempotency.service.ts
// Records (key -> response) for 24h so a retried mutation (village 2G networks
// retry constantly) returns the original result instead of acting twice (Law 3).
export abstract class IdempotencyService {
  abstract remember<T>(key: string, userId: string | undefined, endpoint: string, fn: () => Promise<T>): Promise<T>;
}
export const IDEMPOTENCY_SERVICE = Symbol('IDEMPOTENCY_SERVICE');
