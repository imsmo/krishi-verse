// core/resilience/bulkhead.ts · isolate each dependency's concurrency so one slow dep can't drown
// every request thread. Caps in-flight calls; a bounded queue absorbs bursts; past that, fail fast
// with BulkheadFullError (shed load) rather than pile up unbounded.
import { BulkheadFullError } from './resilience.errors';

export interface BulkheadOptions { maxConcurrent: number; maxQueue: number; }

export class Bulkhead {
  private active = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly dep: string, private readonly opts: BulkheadOptions) {}

  get inFlight(): number { return this.active; }
  get queued(): number { return this.queue.length; }

  async exec<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.opts.maxConcurrent) {
      if (this.queue.length >= this.opts.maxQueue) throw new BulkheadFullError(this.dep);
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      const next = this.queue.shift();
      if (next) next();
    }
  }
}
