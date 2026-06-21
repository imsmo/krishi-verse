// apps/mobile/src/app/(farmer)/tips/saved.tsx · screen 103 (saved tips). Thin screen (guide §3): the farmer's
// DEVICE-LOCAL bookmarks (AsyncStorage, scoped per user — no server bookmark endpoint yet, flagged). Renders from
// the stored snapshots so it works fully offline. Tap to open; remove to unsave. Behind `tips_assistant`.
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Card, EmptyState, StatusPill, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { loadSavedTips, persistSavedTips } from '../../../features/content/content.api';
import { toggleSaved, kindLabelKey, kindTone, type TipSnapshot } from '../../../features/content/content';

export default function SavedTips() {
  const { t } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('tips_assistant');
  const [items, setItems] = useState<TipSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => { setItems(await loadSavedTips()); setLoading(false); }, []);
  useFocusEffect(useCallback(() => { if (enabled) { setLoading(true); load(); } }, [enabled, load]));

  if (!enabled) return <ScreenScaffold title={t('content.saved.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const remove = async (snap: TipSnapshot) => { const next = toggleSaved(items, snap); setItems(next); await persistSavedTips(next); };

  return (
    <ScreenScaffold title={t('content.saved.title')}>
      {loading ? <SkeletonCard lines={4} /> : items.length === 0 ? (
        <EmptyState title={t('content.saved.empty.title')} message={t('content.saved.empty.message')} actionLabel={t('content.tips.title')} onAction={() => router.push('/(farmer)/tips')} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(s) => s.id}
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <Pressable onPress={() => router.push({ pathname: '/(farmer)/tips/[id]', params: { id: item.id } })} accessibilityRole="button" style={styles.row}>
                <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                <StatusPill label={t(kindLabelKey(item.kind))} tone={kindTone(item.kind)} />
              </Pressable>
              <Pressable onPress={() => remove(item)} accessibilityRole="button" style={styles.removeBtn}><Text style={styles.remove}>{t('content.saved.remove')}</Text></Pressable>
            </Card>
          )}
          contentContainerStyle={{ paddingBottom: space[6] }}
        />
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: space[2] },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space[3] },
  title: { flex: 1, fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800 },
  removeBtn: { minHeight: 44, justifyContent: 'center' },
  remove: { fontFamily: font.body, fontSize: font.size.sm, color: color.danger, marginTop: space[2] },
});
