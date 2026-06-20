// apps/mobile/src/core/flags/useFlag.ts · React hook to read a feature flag and re-render when remote config
// (the kill-switch channel) changes. Screens/layouts call this to gate a feature.
import { useSyncExternalStore } from 'react';
import { flags, type FlagKey } from './flags';

export function useFlag(key: FlagKey): boolean {
  return useSyncExternalStore(
    (cb) => flags.subscribe(cb),
    () => flags.isEnabled(key),
    () => flags.isEnabled(key),
  );
}
