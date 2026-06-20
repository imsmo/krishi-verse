// apps/mobile/app.config.ts · Expo app configuration. Uses expo-router (file-based routing under src/app) and
// surfaces the public runtime config via `extra` (read by core/config.ts — no secrets here, only the public API
// origin + optional white-label tenant slug, injected from EXPO_PUBLIC_* env at build time). Deep-link scheme
// `krishiverse` powers OTP/SMS return + notification taps.
import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Krishi-Verse',
  slug: 'krishi-verse',
  scheme: 'krishiverse',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  splash: { backgroundColor: '#1e6f3f', resizeMode: 'contain' },
  assetBundlePatterns: ['**/*'],
  ios: { supportsTablet: false, bundleIdentifier: 'co.krishiverse.app' },
  android: { package: 'co.krishiverse.app', adaptiveIcon: { backgroundColor: '#1e6f3f' } },
  plugins: ['expo-router', 'expo-secure-store', 'expo-localization', 'expo-font'],
  experiments: { typedRoutes: true },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
    tenantSlug: process.env.EXPO_PUBLIC_TENANT_SLUG,
    appEnv: process.env.EXPO_PUBLIC_APP_ENV ?? 'development',
  },
};

export default config;
