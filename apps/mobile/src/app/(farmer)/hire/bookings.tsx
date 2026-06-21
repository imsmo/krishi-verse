// apps/mobile/src/app/(farmer)/hire/bookings.tsx · screen 50 (my bookings — employer). Thin screen (guide §3):
// the farmer's own labour bookings (box=mine), newest-first keyset. Entry points to post a new booking and to
// browse the worker pool. Behind `labour_hire`. Degrade-never-die.
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import type { LabourBooking } from '@krishi-verse/sdk-js';
import { Button, Card, EmptyState, MoneyText, StatusPill, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { myBookings } from '../../../features/labour/hire.api';
import { bookingStatusTone } from '../../../features/labour/booking-flow';

export default function MyBookings() {
  const { t, lang } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('labour_hire');
  const [items, setItems] = useState<LabourBooking[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => { const r = await myBookings(); setItems(r.items); setLoading(false); }, []);
  useFocusEffect(useCallback(() => { if (enabled) { setLoading(true); load(); } }, [enabled, load]));

  if (!enabled) return <ScreenScaffold title={t('hire.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  return (
    <ScreenScaffold title={t('hire.bookings.title')} footer={<Button title={t('hire.post')} onPress={() => router.push('/(farmer)/hire/book')} />}>
      {loading ? <SkeletonCard lines={4} /> : items.length === 0 ? (
        <EmptyState title={t('hire.bookings.empty.title')} message={t('hire.bookings.empty.message')} actionLabel={t('hire.browseWorkers')} onAction={() => router.push('/(farmer)/hire/workers')} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(b) => b.id}
          ListHeaderComponent={<Pressable onPress={() => router.push('/(farmer)/hire/workers')} accessibilityRole="button"><Text style={styles.link}>{t('hire.browseWorkers')} →</Text></Pressable>}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push({ pathname: '/(farmer)/hire/booking/[id]', params: { id: item.id } })} accessibilityRole="button">
              <Card style={styles.card}>
                <View style={styles.row}>
                  <Text style={styles.no}>{t('worker.jobNo', { id: item.bookingNo })}</Text>
                  <StatusPill label={t(`worker.bookingStatus.${item.status}`)} tone={bookingStatusTone(item.status)} />
                </View>
                <View style={[styles.row, { marginTop: space[2] }]}>
                  <Text style={styles.meta}>{t('worker.workersNeeded', { n: item.workersNeeded })}</Text>
                  <MoneyText minor={item.wageOfferedMinor} currencyCode={item.currencyCode} langCode={lang} size="lg" />
                </View>
              </Card>
            </Pressable>
          )}
          contentContainerStyle={{ paddingBottom: space[6] }}
        />
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  link: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.primary700, paddingVertical: space[2] },
  card: { marginBottom: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  no: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800 },
  meta: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500 },
});
