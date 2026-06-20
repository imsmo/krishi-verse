// apps/mobile/src/app/(auth)/_layout.tsx · onboarding/auth stack. Headerless (each screen draws its own header
// via ScreenScaffold). The flow is welcome → language → phone → verify → role → profile, with explicit
// navigation between steps (we don't auto-redirect away once authenticated, because role + profile are
// post-OTP steps still inside this group).
import React from 'react';
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
