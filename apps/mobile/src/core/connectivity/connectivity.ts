// apps/mobile/src/core/connectivity/connectivity.ts · a tiny online/offline store over NetInfo. Screens use the
// useConnectivity() hook (e.g. the offline banner); the sync engine subscribes to flush the write queue when the
// device comes back online. `isOnline` means connected AND internet-reachable (NetInfo can report connected but
// captive-portal'd). Optimistic default = online so we never block a first request at boot.
import { useSyncExternalStore } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

let online = true;
const listeners = new Set<() => void>();
let unsubscribeNet: (() => void) | null = null;

function fromState(s: NetInfoState): boolean {
  // isInternetReachable is null while unknown — treat unknown as reachable to avoid false "offline".
  return !!s.isConnected && s.isInternetReachable !== false;
}

function set(next: boolean) {
  if (next === online) return;
  online = next;
  listeners.forEach((l) => l());
}

/** Begin listening to NetInfo. Returns a stop fn. Safe to call once at boot. */
export function startConnectivity(): () => void {
  if (unsubscribeNet) return unsubscribeNet;
  unsubscribeNet = NetInfo.addEventListener((s) => set(fromState(s)));
  void NetInfo.fetch().then((s) => set(fromState(s)));
  const stop = () => { unsubscribeNet?.(); unsubscribeNet = null; };
  return stop;
}

export function isOnline(): boolean { return online; }
export function subscribeConnectivity(fn: () => void): () => void { listeners.add(fn); return () => listeners.delete(fn); }

/** React hook: true when online. */
export function useConnectivity(): boolean {
  return useSyncExternalStore(subscribeConnectivity, isOnline, isOnline);
}
