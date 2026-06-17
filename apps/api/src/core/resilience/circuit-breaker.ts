// core/resilience/circuit-breaker.ts · one breaker per external dependency (razorpay, razorpayx,
// wallet, msg91, opensearch…). Stops hammering a dead dependency: after `failureThreshold`
// consecutive failures it OPENs (fail fast with CircuitOpenError) for `resetMs`, then allows a
// limited HALF-OPEN trial; a success closes it, a failure re-opens it.
import { CircuitOpenError } from './resilience.errors';

export type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitOptions { failureThreshold: number; resetMs: number; halfOpenMax: number; now?: () => number; }

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private openedAt = 0;
  private halfOpenInFlight = 0;
  private readonly now: () => number;

  constructor(private readonly dep: string, private readonly opts: CircuitOptions) {
    this.now = opts.now ?? Date.now;
  }

  get currentState(): CircuitState { return this.state; }

  async exec<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.now() - this.openedAt < this.opts.resetMs) throw new CircuitOpenError(this.dep);
      this.state = 'half_open';                 // probe window
      this.halfOpenInFlight = 0;
    }
    if (this.state === 'half_open' && this.halfOpenInFlight >= this.opts.halfOpenMax) {
      throw new CircuitOpenError(this.dep);     // cap concurrent trials
    }
    if (this.state === 'half_open') this.halfOpenInFlight++;
    try {
      const r = await fn();
      this.onSuccess();
      return r;
    } catch (err) {
      this.onFailure();
      throw err;
    } finally {
      if (this.state === 'half_open' && this.halfOpenInFlight > 0) this.halfOpenInFlight--;
    }
  }

  private onSuccess(): void { this.failures = 0; this.state = 'closed'; }
  private onFailure(): void {
    this.failures++;
    if (this.state === 'half_open' || this.failures >= this.opts.failureThreshold) {
      this.state = 'open';
      this.openedAt = this.now();
    }
  }
}
