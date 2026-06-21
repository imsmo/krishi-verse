// apps/mobile/src/app/(farmer)/tips/category.tsx · screen 102 (browse by category). Thin screen (guide §3): pick a
// category (= resource KIND — no topic-name endpoint, flagged) and see its tips. Reads cached tips → offline.
// Behind `tips_assistant`. Degrade-never-die.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import type { LearningResource, ResourceKind } from '@krishi-verse/sdk-js';
import { Card, EmptyState, ScreenScaffold, SkeletonCard, color, font, space, radius } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { listTips } from '../../../features/content/content.api';
import { groupByKind, kindLabelKey } from '../../../features/content/content';

export default function TipsCategory() {
  const { kind: kindParam } = useLocalSearchParams<{ kind?: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('tips_assistant');
  const [all, setAll] = useState<LearningResource[]>([]);
  const [kind, setKind] = useState<ResourceKind | null>((kindParam as ResourceKind) ?? null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => { const r = await listTips(); setAll(r.items); setLoading(false); }, []);
  useEffect(() => { if (enabled) load(); }, [enabled, load]);

  const sections = useMemo(() => groupByKind(all), [all]);
  const active = kind ?? sections[0]?.kind ?? null;
  const items = useMemo(() => (active ? all.filter((r) => r.kind === active) : []), [all, active]);

  if (!enabled) return <ScreenScaffold title={t('content.category.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  return (
    <ScreenScaffold title={t('content.category.title')}>
      {loading ? <SkeletonCard lines={5} /> : sections.length === 0 ? (
        <EmptyState title={t('content.tips.empty.title')} message={t('content.tips.empty.message')} actionLabel={t('common.retry')} onAction={load} />
      ) : (
        <>
          <FlatList
            horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}
            data={sections}
            keyExtractor={(s) => s.kind}
            renderItem={({ item: s }) => {
              const on = active === s.kind;
              return (
                <Pressable onPress={() => setKind(s.kind)} style={[styles.chip, on && styles.chipOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{t(kindLabelKey(s.kind))} · {s.items.length}</Text>
                </Pressable>
              );
            }}
          />
          <FlatList
            data={items}
            keyExtractor={(r) => r.id}
            renderItem={({ item }) => (
              <Pressable onPress={() => router.push({ pathname: '/(farmer)/tips/[id]', params: { id: item.id } })} accessibilityRole="button">
                <Card style={styles.card}>
                  <Text style={styles.tipTitle} numberOfLines={2}>{item.title}</Text>
                  {item.body ? <Text style={styles.preview} numberOfLines={2}>{item.body}</Text> : null}
                </Card>
              </Pressable>
            )}
            contentContainerStyle={{ paddingBottom: space[6] }}
          />
        </>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  chipRow: { marginBottom: space[2], flexGrow: 0 },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space[3], marginRight: space[2], borderRadius: radius.pill, borderWidth: 1.5, borderColor: color.ink200, backgroundColor: color.card },
  chipOn: { borderColor: color.primary600 },
  chipText: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink600 },
  chipTextOn: { color: color.primary800, fontWeight: font.weight.semibold },
  card: { marginBottom: space[2] },
  tipTitle: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800 },
  preview: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500, marginTop: space[1] },
});
