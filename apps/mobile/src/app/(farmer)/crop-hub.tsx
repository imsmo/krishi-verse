// apps/mobile/src/app/(farmer)/crop-hub.tsx · screen 104 (crop hub). Thin screen (guide §3): a curated landing
// that groups approved tips by kind into sections (PURE groupByKind) with quick entries to the AI assistant +
// voice search + saved tips. Reads cached tips → offline. Behind `tips_assistant`. Degrade-never-die.
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import type { LearningResource } from '@krishi-verse/sdk-js';
import { Card, EmptyState, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { listTips } from '../../features/content/content.api';
import { groupByKind, kindLabelKey } from '../../features/content/content';

export default function CropHub() {
  const { t } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('tips_assistant');
  const [all, setAll] = useState<LearningResource[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => { const r = await listTips(); setAll(r.items); setLoading(false); }, []);
  useFocusEffect(useCallback(() => { if (enabled) { setLoading(true); load(); } }, [enabled, load]));
  const sections = useMemo(() => groupByKind(all), [all]);

  if (!enabled) return <ScreenScaffold title={t('content.cropHub.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  return (
    <ScreenScaffold title={t('content.cropHub.title')}>
      <View style={styles.quick}>
        <Pressable onPress={() => router.push('/(farmer)/assistant')} accessibilityRole="button" style={styles.tile}><Text style={styles.tileIcon}>🤖</Text><Text style={styles.tileLabel}>{t('content.assistant.title')}</Text></Pressable>
        <Pressable onPress={() => router.push('/(farmer)/voice-search')} accessibilityRole="button" style={styles.tile}><Text style={styles.tileIcon}>🎙️</Text><Text style={styles.tileLabel}>{t('content.voiceSearch.title')}</Text></Pressable>
        <Pressable onPress={() => router.push('/(farmer)/tips/saved')} accessibilityRole="button" style={styles.tile}><Text style={styles.tileIcon}>🔖</Text><Text style={styles.tileLabel}>{t('content.saved.title')}</Text></Pressable>
      </View>

      {loading ? <SkeletonCard lines={6} /> : sections.length === 0 ? (
        <EmptyState title={t('content.tips.empty.title')} message={t('content.tips.empty.message')} actionLabel={t('common.retry')} onAction={load} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: space[6] }} showsVerticalScrollIndicator={false}>
          {sections.map((s) => (
            <View key={s.kind} style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>{t(kindLabelKey(s.kind))}</Text>
                <Pressable onPress={() => router.push({ pathname: '/(farmer)/tips/category', params: { kind: s.kind } })} accessibilityRole="button"><Text style={styles.seeAll}>{t('content.cropHub.seeAll')}</Text></Pressable>
              </View>
              {s.items.slice(0, 3).map((r) => (
                <Pressable key={r.id} onPress={() => router.push({ pathname: '/(farmer)/tips/[id]', params: { id: r.id } })} accessibilityRole="button">
                  <Card style={styles.card}><Text style={styles.tipTitle} numberOfLines={2}>{r.title}</Text></Card>
                </Pressable>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  quick: { flexDirection: 'row', gap: space[2], marginBottom: space[3] },
  tile: { flex: 1, minHeight: 72, alignItems: 'center', justifyContent: 'center', backgroundColor: color.primary50, borderRadius: 12, paddingVertical: space[2] },
  tileIcon: { fontSize: 24 },
  tileLabel: { fontFamily: font.body, fontSize: font.size.xs, color: color.ink700, marginTop: space[1], textAlign: 'center' },
  section: { marginBottom: space[4] },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space[2] },
  sectionTitle: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.bold, color: color.ink900 },
  seeAll: { fontFamily: font.body, fontSize: font.size.sm, fontWeight: font.weight.semibold, color: color.primary700 },
  card: { marginBottom: space[2] },
  tipTitle: { fontFamily: font.body, fontSize: font.size.md, color: color.ink800 },
});
