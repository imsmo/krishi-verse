// @krishi-verse/sdk-js · tenancy resource (P-17 — tenant-admin-lite). Plans catalogue + the tenant's subscription
// (apply / current / list). create is idempotent (Law 3; a paid plan moves money SERVER-SIDE — the app never
// does, Law 11). Money is bigint minor strings (Law 2). Gated server-side by the tenant's own permissions.
import { HttpClient } from '../http';
import { Plan, Subscription, Page } from '../types';

export class TenancyResource {
  constructor(private readonly http: HttpClient) {}

  /** Public plan catalogue (apply screen). */
  async plans(signal?: AbortSignal): Promise<Plan[]> {
    return (await this.http.request<Plan[]>('GET', 'plans', { signal })).data;
  }
  /** The tenant's current subscription (+ limits/usage), or { subscription: null } before applying. */
  async currentSubscription(signal?: AbortSignal): Promise<{ subscription: Subscription | null; limits?: Record<string, string>; usage?: Record<string, string> }> {
    return (await this.http.request<{ subscription: Subscription | null; limits?: Record<string, string>; usage?: Record<string, string> }>('GET', 'subscriptions/current', { signal })).data;
  }
  async listSubscriptions(cursor?: string, signal?: AbortSignal): Promise<Page<Subscription>> {
    const r = await this.http.request<Subscription[]>('GET', 'subscriptions', { query: { cursor }, signal });
    return { items: r.data, nextCursor: (r.meta?.nextCursor as string | null) ?? null };
  }
  /** Apply for a plan (create a subscription). Idempotent (Law 3). */
  async apply(input: { planId: string; billingCycle?: 'monthly' | 'annual' }, idempotencyKey: string): Promise<Subscription> {
    return (await this.http.request<Subscription>('POST', 'subscriptions', { idempotencyKey, body: input })).data;
  }
}
