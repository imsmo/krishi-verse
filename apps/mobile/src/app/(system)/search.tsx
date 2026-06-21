// apps/mobile/src/app/(system)/search.tsx · screen 183 (global search). Thin screen (guide §3): one box searches
// across the public listings catalogue + the caller's own orders (merged client-side; debounced). Tap a hit to
// open it. Behind `system_screens`. Degrade-never-die. NOTE: no dedicated search endpoint yet → fan-out over
// existing reads (flagged); the server enforces visibility + ownership on each underlying call.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Input, EmptyState, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { globalSearch } from '../../features/system/system.api';
import { normalizeQuery, type SearchHit } from '../../features/system/system';

export default function GlobalSearch() {
  const { t } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('system_screens');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = useCallback(async (q: string) => {
    if (!normalizeQuery(q)) { setHits([]); setSearched(false); return; }
    setLoading(true); setSearched(true);
    setHits(await globalSearch(q));
    setLoading(false);
  }, []);

  // Debounce search input (perf §5 — never hammer the API on each keystroke).
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => run(query), 350);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query, run]);

  if (!enabled) return <ScreenScaffold title={t('system.search.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const open = (h: SearchHit) => {
    if (h.kind === 'listing') router.push({ pathname: '/(buyer)/listing/[id]', params: { id: h.id } } as never);
    else router.push({ pathname: '/(farmer)/orders/[id]', params: { id: h.id } } as never);
  };

  return (
    <ScreenScaffold title={t('system.search.title')}>
      <Input label={t('system.search.label')} value={query} onChangeText={setQuery} placeholder={t('system.search.placeholder')} autoFocus returnKeyType="search" onSubmitEditing={() => run(query)} />
      {loading ? <SkeletonCard lines={5} /> : !searched ? (
        <EmptyState title={t('system.search.hint.title')} message={t('system.search.hint.message')} />
      ) : hits.length === 0 ? (
        <EmptyState title={t('system.search.empty.title')} message={t('system.search.empty.message', { q: normalizeQuery(query) })} />
      ) : (
        <FlatList
          data={hits}
          keyExtractor={(h) => `${h.kind}:${h.id}`}
          renderItem={({ item }) => (
            <Pressable onPress={() => open(item)} accessibilityRole="button">
              <Card style={styles.card}>
                <View style={styles.row}>
                  <Text style={styles.kind}>{t(`system.search.kind.${item.kind}`)}</Text>
                  {item.subtitle ? <Text style={styles.sub}>{item.subtitle}</Text> : null}
                </View>
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
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
  card: { marginBottom: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kind: { fontFamily: font.body, fontSize: font.size.xs, fontWeight: font.weight.semibold, color: color.primary700, textTransform: 'uppercase' },
  sub: { fontFamily: font.body, fontSize: font.size.xs, color: color.ink400 },
  title: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800, marginTop: space[1] },
});
