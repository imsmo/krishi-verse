// apps/mobile/src/core/security/screen-guard.ts · FLAG_SECURE for sensitive screens (guide §4). A screen that
// shows money, KYC docs, or payment UI calls useSecureScreen() to block screenshots/screen-recording while it's
// mounted (expo-screen-capture), and re-allows capture on unmount. Fails soft — if the native module is missing
// it simply no-ops (never crashes a screen, Law 12).
import { useEffect } from 'react';
import * as ScreenCapture from 'expo-screen-capture';

export function useSecureScreen(): void {
  useEffect(() => {
    let active = true;
    ScreenCapture.preventScreenCaptureAsync().catch(() => { /* no-op: degrade */ });
    return () => {
      active = false;
      ScreenCapture.allowScreenCaptureAsync().catch(() => { /* no-op */ });
      void active;
    };
  }, []);
}
