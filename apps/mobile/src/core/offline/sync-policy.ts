// apps/mobile/src/core/offline/sync-policy.ts · the PURE transition guards for the sync engine (no react-native
// imports) so they're unit-testable offline. sync.engine re-exports these and wires the NetInfo/AppState
// listeners around them.
export function shouldFlushOnConnectivity(prevOnline: boolean, nextOnline: boolean): boolean {
  return !prevOnline && nextOnline; // only on the offline→online edge
}
export function shouldFlushOnAppState(prev: string, next: string, online: boolean): boolean {
  return prev !== 'active' && next === 'active' && online; // on foreground, when online
}
