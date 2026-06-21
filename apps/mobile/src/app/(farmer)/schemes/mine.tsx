// apps/mobile/src/app/(farmer)/schemes/mine.tsx · screen 109 (my schemes). Thin screen (guide §3): the caller's own
// scheme applications (keyset, owner-scoped server-side), tap → status. Behind `schemes_govt`. Degrade-never-die.
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import type { SchemeApplication } from '@krishi-verse/sdk-js';
import { Card, EmptyState, StatusPill, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { formatDate } from '@krishi-verse/i18n';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { myApplications } from '../../../features/schemes/schemes.api';
import { applicationStatusTone } from '../../../features/schemes/schemes';

export default function MySchemes() {
  const { t, lang } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('schemes_govt');
  const [items, setItems] = useState<SchemeApplication[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [paging, setPaging] = useState(false);

  const load = useCallback(async () => { const r = await myApplications(); setItems(r.items); setCursor(r.nextCursor); setLoading(false); }, []);
  useFocusEffect(useCallback(() => { if (enabled) { setLoading(true); load(); } }, [enabled, load]));

  const more = useCallback(async () => {
    if (!cursor || paging) return;
    setPaging(true);
    try { const r = await myApplications(cursor); setItems((prev) => [...prev, ...r.items]); setCursor(r.nextCursor); }
    finally { setPaging(false); }
  }, [cursor, paging]);

  if (!enabled) return <ScreenScaffold title={t('schemes.mine.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  return (
    <ScreenScaffold title={t('schemes.mine.title')}>
      {loading ? <SkeletonCard lines={5} /> : items.length === 0 ? (
        <EmptyState title={t('schemes.mine.empty.title')} message={t('schemes.mine.empty.message')} actionLabel={t('schemes.title')} onAction={() => router.push('/(farmer)/schemes')} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(a) => a.id}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push({ pathname: '/(farmer)/schemes/status', params: { id: item.id } })} accessibilityRole="button">
              <Card style={styles.card}>
                <View style={styles.row}>
                  <Text style={styles.id}>{item.govtAppRef ?? item.id.slice(0, 8).toUpperCase()}</Text>
                  <StatusPill label={t(`schemes.statusLabel.${item.status}`, { defaultValue: item.status })} tone={applicationStatusTone(item.status)} />
                </View>
                {item.submittedAt ? <Text style={styles.meta}>{t('schemes.status.submitted')}: {safeDate(item.submittedAt, lang)}</Text> : null}
              </Card>
            </Pressable>
          )}
          onEndReached={more}
          onEndReachedThreshold={0.5}
          ListFooterComponent={paging ? <SkeletonCard lines={1} /> : null}
          contentContainerStyle={{ paddingBottom: space[6] }}
        />
      )}
    </ScreenScaffold>
  );
}

function safeDate(value: string, langCode: string): string { try { return formatDate(value, langCode); } catch { return value; } }

const styles = StyleSheet.create({
  card: { marginBottom: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  id: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800 },
  meta: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500, marginTop: space[1] },
});
