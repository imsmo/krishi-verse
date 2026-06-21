// apps/mobile/src/app/(farmer)/_layout.tsx · the farmer role's bottom-tab navigator (screen 09's tab bar:
// Home / Listings / Orders / Wallet / Profile). Auth-gated: an anonymous session is redirected to onboarding
// (the server also re-enforces auth on every call — this is just UX). Tab labels are localized.
import React, { useEffect } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { Text, View } from 'react-native';
import { color, font, EmptyState } from '@krishi-verse/ui-native';
import { useAuth } from '../../core/auth/auth.store';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { startPush } from '../../core/push/push';

function Icon({ glyph, focused }: { glyph: string; focused: boolean }) {
  return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }} accessibilityElementsHidden importantForAccessibility="no">{glyph}</Text>;
}

export default function FarmerTabsLayout() {
  const { state } = useAuth();
  const { t } = useTranslation();
  const farmerOn = useFlag('farmer_app');
  const notifOn = useFlag('notifications');
  // Register for push + attach tap-routing once the authenticated farmer area mounts (JIT permission inside).
  useEffect(() => {
    if (state.status !== 'authenticated' || !notifOn) return;
    let cleanup: (() => void) | undefined;
    startPush().then((c) => { cleanup = c; }).catch(() => { /* push is best-effort */ });
    return () => cleanup?.();
  }, [state.status, notifOn]);
  if (state.status === 'anonymous') return <Redirect href="/(auth)/welcome" />;
  // Kill-switch: if ops disabled the farmer vertical via remote config, show a maintenance state (Law 10).
  if (!farmerOn) return <View style={{ flex: 1, backgroundColor: color.page, justifyContent: 'center' }}><EmptyState title={t('common.unavailable')} /></View>;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.primary600,
        tabBarInactiveTintColor: color.ink400,
        tabBarStyle: { backgroundColor: color.card, borderTopColor: color.ink100, height: 64, paddingBottom: 8, paddingTop: 6 },
        tabBarLabelStyle: { fontFamily: font.body, fontSize: font.size.xs, fontWeight: font.weight.semibold },
      }}
    >
      <Tabs.Screen name="home" options={{ title: t('tabs.home'), tabBarIcon: ({ focused }) => <Icon glyph="🏠" focused={focused} /> }} />
      <Tabs.Screen name="listings/index" options={{ title: t('tabs.listings'), tabBarIcon: ({ focused }) => <Icon glyph="🌾" focused={focused} /> }} />
      <Tabs.Screen name="orders" options={{ title: t('tabs.orders'), tabBarIcon: ({ focused }) => <Icon glyph="📦" focused={focused} /> }} />
      <Tabs.Screen name="wallet/index" options={{ title: t('tabs.wallet'), tabBarIcon: ({ focused }) => <Icon glyph="💰" focused={focused} /> }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile'), tabBarIcon: ({ focused }) => <Icon glyph="👤" focused={focused} /> }} />
      {/* Detail/create/sub routes live in the stack but are hidden from the tab bar. */}
      <Tabs.Screen name="listings/new" options={{ href: null }} />
      <Tabs.Screen name="listings/[id]" options={{ href: null }} />
      <Tabs.Screen name="listings/preview" options={{ href: null }} />
      <Tabs.Screen name="listings/edit" options={{ href: null }} />
      <Tabs.Screen name="wallet/add-money" options={{ href: null }} />
      <Tabs.Screen name="wallet/withdraw" options={{ href: null }} />
      <Tabs.Screen name="wallet/transactions" options={{ href: null }} />
      <Tabs.Screen name="wallet/payouts" options={{ href: null }} />
      <Tabs.Screen name="wallet/txn-detail" options={{ href: null }} />
      <Tabs.Screen name="kyc/index" options={{ href: null }} />
      <Tabs.Screen name="notifications/index" options={{ href: null }} />
      <Tabs.Screen name="notifications/[id]" options={{ href: null }} />
      <Tabs.Screen name="notifications/settings" options={{ href: null }} />
    </Tabs>
  );
}
