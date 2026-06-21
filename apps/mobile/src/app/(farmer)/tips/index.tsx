// apps/mobile/src/app/(farmer)/tips/index.tsx · screen 55 (tips library). Thin screen (guide §3): browse approved
// curated tips (cached → offline), filter by kind (category) chips + a text search (local, ReDoS-safe). Tap a tip
// for detail; links to saved tips + crop hub + the AI assistant + voice search. Behind `tips_assistant`.
// Degrade-never-die. NOTE: "category" = resource KIND — there's no topic-name endpoint (flagged).
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import type { LearningResource, ResourceKind } from '@krishi-verse/sdk-js';
import { Card, Input, EmptyState, StatusPill, ScreenScaffold, SkeletonCard, color, font, space, radius } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { listTips } from '../../../features/content/content.api';
import { searchResources, groupByKind, RESOURCE_KINDS, kindLabelKey, kindTone } from '../../../features/content/content';

export default function TipsLibrary() {
  const { t } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('tips_assistant');
  const [all, setAll] = useState<LearningResource[]>([]);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<ResourceKind | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => { const r = await listTips(); setAll(r.items); setLoading(false); }, []);
  useFocusEffect(useCallback(() => { if (enabled) { setLoading(true); load(); } }, [enabled, load]));

  const items = useMemo(() => {
    const byKind = kind ? all.filter((r) => r.kind === kind) : all;
    return searchResources(byKind, query);
  }, [all, kind, query]);
  const kindsPresent = useMemo(() => groupByKind(all).map((s) => s.kind), [all]);

  if (!enabled) return <ScreenScaffold title={t('content.tips.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  return (
    <ScreenScaffold title={t('content.tips.title')}>
      <View style={styles.links}>
        <Pressable onPress={() => router.push('/(farmer)/crop-hub')} accessibilityRole="button"><Text style={styles.link}>🌱 {t('content.cropHub.title')}</Text></Pressable>
        <Pressable onPress={() => router.push('/(farmer)/tips/saved')} accessibilityRole="button"><Text style={styles.link}>🔖 {t('content.saved.title')}</Text></Pressable>
        <Pressable onPress={() => router.push('/(farmer)/assistant')} accessibilityRole="button"><Text style={styles.link}>🤖 {t('content.assistant.title')}</Text></Pressable>
      </View>
      <Input label={t('content.search.label')} value={query} onChangeText={setQuery} placeholder={t('content.search.placeholder')} returnKeyType="search" />
      <Pressable onPress={() => router.push('/(farmer)/voice-search')} accessibilityRole="button" style={styles.voiceLink}><Text style={styles.link}>🎙️ {t('content.voiceSearch.cta')}</Text></Pressable>

      {kindsPresent.length > 0 ? (
        <FlatList
          horizontal showsHorizontalScrollIndicator={false}
          style={styles.chipRow}
          data={[null, ...RESOURCE_KINDS.filter((k) => kindsPresent.includes(k))] as (ResourceKind | null)[]}
          keyExtractor={(k) => k ?? 'all'}
          renderItem={({ item: k }) => {
            const on = kind === k;
            return (
              <Pressable onPress={() => setKind(k)} style={[styles.chip, on && styles.chipOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{k ? t(kindLabelKey(k)) : t('content.kind.all')}</Text>
              </Pressable>
            );
          }}
        />
      ) : null}

      {loading ? <SkeletonCard lines={5} /> : items.length === 0 ? (
        <EmptyState title={t('content.tips.empty.title')} message={t('content.tips.empty.message')} actionLabel={t('common.retry')} onAction={load} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push({ pathname: '/(farmer)/tips/[id]', params: { id: item.id } })} accessibilityRole="button">
              <Card style={styles.card}>
                <View style={styles.row}>
                  <Text style={styles.tipTitle} numberOfLines={2}>{item.title}</Text>
                  <StatusPill label={t(kindLabelKey(item.kind))} tone={kindTone(item.kind)} />
                </View>
                {item.body ? <Text style={styles.preview} numberOfLines={2}>{item.body}</Text> : null}
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
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3], paddingBottom: space[2] },
  link: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.primary700, minHeight: 44, paddingVertical: space[1] },
  voiceLink: { paddingVertical: space[1] },
  chipRow: { marginVertical: space[2], flexGrow: 0 },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space[3], marginRight: space[2], borderRadius: radius.pill, borderWidth: 1.5, borderColor: color.ink200, backgroundColor: color.card },
  chipOn: { borderColor: color.primary600 },
  chipText: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink600 },
  chipTextOn: { color: color.primary800, fontWeight: font.weight.semibold },
  card: { marginBottom: space[2] },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space[3] },
  tipTitle: { flex: 1, fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800 },
  preview: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500, marginTop: space[1] },
});
