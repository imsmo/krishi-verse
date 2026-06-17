// core/resilience/timeout.ts · no unbounded waits — every external call has a deadline.
import { TimeoutError } from './resilience.errors';

/** Reject with TimeoutError if `fn` doesn't settle within `ms`. The underlying promise is left to
 *  settle (we can't cancel it), but the caller stops waiting — preventing a hung dep from pinning
 *  a request thread forever. */
export async function withTimeout<T>(dep: string, ms: number, fn: () => Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout;
  const guard = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(dep, ms)), ms);
  });
  try {
    return await Promise.race([fn(), guard]);
  } finally {
    clearTimeout(timer!);
  }
}
