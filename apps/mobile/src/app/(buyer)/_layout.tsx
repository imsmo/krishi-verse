// apps/mobile/src/app/(buyer)/_layout.tsx · the buyer role's bottom-tab navigator (Home / Search / Saved).
// Mirrors the (farmer) layout: auth-gated (anonymous → onboarding; the server re-enforces on every call — this is
// UX) and behind the `buyer_app` kill-switch flag (Law 10), so the whole vertical can be disabled without a
// release. Detail/filter/seller routes live in the stack but are hidden from the tab bar.
import React from 'react';
import { Redirect, Tabs } from 'expo-router';
import { Text, View } from 'react-native';
import { color, font, EmptyState } from '@krishi-verse/ui-native';
import { useAuth } from '../../core/auth/auth.store';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';

function Icon({ glyph, focused }: { glyph: string; focused: boolean }) {
  return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }} accessibilityElementsHidden importantForAccessibility="no">{glyph}</Text>;
}

export default function BuyerTabsLayout() {
  const { state } = useAuth();
  const { t } = useTranslation();
  const buyerOn = useFlag('buyer_app');
  if (state.status === 'anonymous') return <Redirect href="/(auth)/welcome" />;
  if (!buyerOn) return <View style={{ flex: 1, backgroundColor: color.page, justifyContent: 'center' }}><EmptyState title={t('common.unavailable')} /></View>;

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
      <Tabs.Screen name="search" options={{ title: t('buyer.tabs.search'), tabBarIcon: ({ focused }) => <Icon glyph="🔍" focused={focused} /> }} />
      <Tabs.Screen name="saved" options={{ title: t('buyer.tabs.saved'), tabBarIcon: ({ focused }) => <Icon glyph="♥" focused={focused} /> }} />
      {/* hidden stack routes */}
      <Tabs.Screen name="filters" options={{ href: null }} />
      <Tabs.Screen name="listings/[id]" options={{ href: null }} />
      <Tabs.Screen name="seller/[id]" options={{ href: null }} />
    </Tabs>
  );
}
