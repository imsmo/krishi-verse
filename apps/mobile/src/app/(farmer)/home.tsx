// apps/mobile/src/app/(farmer)/home.tsx · screen 09 (farmer home). Thin screen (guide §3): it calls the
// feature data layer (features/farmer/dashboard.api) and renders ui-native components — no direct API/fetch, no
// business logic. Marquee "sell in 60s" voice/photo CTAs, My-Listings + Wallet tiles, mandi pulse (hidden on
// failure — never faked), today's tip. Money via MoneyText from bigint-minor (Law 2). Pull-to-refresh.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Card, MoneyText, VoiceButton, color, font, space, radius, shadow } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useAuth } from '../../core/auth/auth.store';
import { useFlag } from '../../core/flags/useFlag';
import { loadFarmerHome, type MandiRow } from '../../features/farmer/dashboard.api';

export default function FarmerHome() {
  const router = useRouter();
  const { t, lang } = useTranslation();
  const { state, loadProfile } = useAuth();
  const notifOn = useFlag('notifications');
  const [listingCount, setListingCount] = useState<number | null>(null);
  const [mandi, setMandi] = useState<MandiRow[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    await loadProfile();
    const home = await loadFarmerHome();
    setListingCount(home.listingCount);
    setMandi(home.mandi);
  }, [loadProfile]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = useCallback(async () => { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } }, [load]);

  const name = state.profile?.displayName ?? t('home.defaultName');

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.primary600} />}>
        <View style={styles.greetRow}>
          <Text style={styles.greeting}>{t('home.greeting', { name })}</Text>
          {notifOn ? (
            <Pressable onPress={() => router.push('/(farmer)/notifications')} accessibilityRole="button" accessibilityLabel={t('notifications.title')} hitSlop={8}>
              <Text style={styles.bell}>🔔</Text>
            </Pressable>
          ) : null}
        </View>

        <Card style={styles.hero}>
          <Text style={styles.heroTitle}>{t('home.sellIn60')}</Text>
          <View style={{ marginTop: space[3], gap: space[3] }}>
            <VoiceButton label={t('home.speakToSell')} hint={t('home.aiPowered')} onPress={() => router.push('/(farmer)/listings/new')} />
            <Pressable onPress={() => router.push('/(farmer)/listings/new')} style={styles.photoBtn} accessibilityRole="button" accessibilityLabel={t('home.photo')}>
              <Text style={styles.photoBtnText}>📷 {t('home.photo')}</Text>
            </Pressable>
          </View>
        </Card>

        <View style={styles.tiles}>
          <Card style={styles.tile} onPress={() => router.push('/(farmer)/listings')} accessibilityLabel={t('home.myListings')}>
            <Text style={styles.tileLabel}>{t('home.myListings')}</Text>
            <Text style={styles.tileValue}>{listingCount ?? '—'}</Text>
          </Card>
          <Card style={styles.tile} onPress={() => router.push('/(farmer)/wallet')} accessibilityLabel={t('home.wallet')}>
            <Text style={styles.tileLabel}>{t('home.wallet')}</Text>
            <MoneyText minor={'0'} langCode={lang} size="2xl" />
          </Card>
        </View>

        {mandi && mandi.length > 0 ? (
          <View>
            <Text style={styles.sectionTitle}>{t('home.mandiPulse')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[3], paddingVertical: space[2] }}>
              {mandi.map((m) => (
                <View key={m.id} style={styles.mandiCard}>
                  <Text style={styles.mandiName}>{m.commodity}</Text>
                  <MoneyText minor={m.modalPriceMinor} langCode={lang} size="lg" />
                  <Text style={styles.perQtl}>{t('home.perQtl')}</Text>
                  <Text style={[styles.change, { color: m.changePct >= 0 ? color.successDark : color.dangerDark }]}>
                    {m.changePct >= 0 ? '▲' : '▼'} {Math.abs(m.changePct).toFixed(1)}%
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.page },
  content: { padding: space[5], gap: space[4] },
  greetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greeting: { fontFamily: font.display, fontSize: font.size['2xl'], fontWeight: font.weight.bold, color: color.ink800, flex: 1 },
  bell: { fontSize: 24 },
  hero: { backgroundColor: color.primary600 },
  heroTitle: { fontFamily: font.display, fontSize: font.size.xl, fontWeight: font.weight.bold, color: color.white },
  photoBtn: { backgroundColor: color.primary700, borderRadius: radius.md, paddingVertical: space[3], alignItems: 'center' },
  photoBtnText: { fontFamily: font.body, fontSize: font.size.lg, fontWeight: font.weight.semibold, color: color.white },
  tiles: { flexDirection: 'row', gap: space[4] },
  tile: { flex: 1 },
  tileLabel: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500 },
  tileValue: { fontFamily: font.display, fontSize: font.size['2xl'], fontWeight: font.weight.bold, color: color.ink800, marginTop: space[1] },
  sectionTitle: { fontFamily: font.body, fontSize: font.size.lg, fontWeight: font.weight.semibold, color: color.ink700, marginBottom: space[1] },
  mandiCard: { width: 130, backgroundColor: color.card, borderRadius: radius.lg, padding: space[3], ...shadow.card },
  mandiName: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink700, marginBottom: space[1] },
  perQtl: { fontFamily: font.body, fontSize: font.size.xs, color: color.ink400 },
  change: { fontFamily: font.body, fontSize: font.size.sm, fontWeight: font.weight.semibold, marginTop: space[1] },
});
