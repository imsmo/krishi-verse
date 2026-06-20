// apps/mobile/src/core/offline/sync.engine.ts · drains the durable write queue (OfflineQueue, via sync-queue's
// dispatched flush) at the right moments: when the device transitions offline→online, and when the app returns
// to the foreground. This is how a listing/media op created in a dead-zone replays the moment signal returns —
// with the SAME idempotency keys, so a flush can never double-apply (Law 3). The transition guards are PURE
// (unit-tested); start() wires the NetInfo + AppState listeners and guards against overlapping flushes.
import { AppState, type AppStateStatus } from 'react-native';
import { startConnectivity, subscribeConnectivity, isOnline } from '../connectivity/connectivity';
import { flushQueue } from './sync-queue';
import { shouldFlushOnConnectivity, shouldFlushOnAppState } from './sync-policy';

export { shouldFlushOnConnectivity, shouldFlushOnAppState } from './sync-policy';

let flushing = false;
async function flushOnce(): Promise<void> {
  if (flushing) return;          // guard: never run two flushes concurrently (avoids double-send races)
  flushing = true;
  try { await flushQueue(); } catch { /* queue handles its own retries */ } finally { flushing = false; }
}

/** Start the sync engine. Returns a stop() cleanup. Call once at app boot. */
export function startSyncEngine(): () => void {
  const stopNet = startConnectivity();
  let prevOnline = isOnline();
  let prevAppState: AppStateStatus = AppState.currentState;

  const unsubConn = subscribeConnectivity(() => {
    const next = isOnline();
    if (shouldFlushOnConnectivity(prevOnline, next)) void flushOnce();
    prevOnline = next;
  });
  const sub = AppState.addEventListener('change', (next) => {
    if (shouldFlushOnAppState(prevAppState, next, isOnline())) void flushOnce();
    prevAppState = next;
  });

  void flushOnce(); // attempt once at boot (best-effort)
  return () => { unsubConn(); sub.remove(); stopNet(); };
}
