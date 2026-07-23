// apps/mobile/src/core/security/screen-guard.ts · FLAG_SECURE for sensitive screens (guide §4). A screen that
// shows money, KYC docs, or payment UI calls useSecureScreen() to block screenshots/screen-recording while it's
// the FOCUSED screen (expo-screen-capture), and re-allows capture the moment it's no longer the front-most screen.
// Fails soft — if the native module is missing it simply no-ops (never crashes a screen, Law 12).
//
// MF-01 root-cause fix: this used to be a plain `useEffect` (mount/unmount). FLAG_SECURE is a per-Activity/
// per-window OS flag, but Tabs + native-stack navigators do NOT unmount a screen when you merely navigate away
// from it (a farmer tab like Profile stays mounted underneath; a pushed screen stays mounted under the one on
// top). So a mount-effect's cleanup often never ran: once a farmer opened any secure screen (Profile/Bank/
// Documents/Wallet), the OS secure flag stayed engaged for the rest of the session, and every OTHER screen
// (including ones that never call this hook, like Farm Details) rendered as a solid black frame in any screen
// recording/mirroring from then on — exactly the "pure black void" seen mid-way through the MF-01 walkthrough.
// The fix: gate on navigation FOCUS/BLUR (useFocusEffect), not React mount/unmount, so the flag tracks which
// screen is actually front-most.
import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import * as ScreenCapture from 'expo-screen-capture';
import { engageSecureScreen } from './screen-capture-guard';

// Pure on/blur logic (unit-tested without a React renderer) lives in screen-capture-guard.ts; re-exported here
// so existing call sites don't need to know about the split.
export { engageSecureScreen, type ScreenCaptureGuard } from './screen-capture-guard';

export function useSecureScreen(): void {
  useFocusEffect(useCallback(() => engageSecureScreen(ScreenCapture), []));
}
