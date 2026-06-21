// apps/mobile/src/app/(farmer)/schemes/index.tsx · screen 60 (schemes). Thin screen (guide §3): browse the govt
// scheme catalogue (cached → offline), link to my applications, tap a scheme for detail/eligibility/apply.
// Behind `schemes_govt`. Degrade-never-die. NOTE: scheme/benefit names come from the server catalogue (not faked).
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import type { Scheme } from '@krishi-verse/sdk-js';
import { Card, EmptyState, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { listSchemes } from '../../../features/schemes/schemes.api';

export default function Schemes() {
  const { t } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('schemes_govt');
  const [items, setItems] = useState<Scheme[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => { setItems(await listSchemes()); setLoading(false); }, []);
  useFocusEffect(useCallback(() => { if (enabled) { setLoading(true); load(); } }, [enabled, load]));

  if (!enabled) return <ScreenScaffold title={t('schemes.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  return (
    <ScreenScaffold title={t('schemes.title')}>
      <Pressable onPress={() => router.push('/(farmer)/schemes/mine')} accessibilityRole="button"><Text style={styles.link}>📋 {t('schemes.mine.title')} →</Text></Pressable>
      {loading ? <SkeletonCard lines={5} /> : items.length === 0 ? (
        <EmptyState title={t('schemes.empty.title')} message={t('schemes.empty.message')} actionLabel={t('common.retry')} onAction={load} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(s) => s.id}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push({ pathname: '/(farmer)/schemes/[id]', params: { id: item.id } })} accessibilityRole="button">
              <Card style={styles.card}>
                <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
                {item.code ? <Text style={styles.code}>{item.code}</Text> : null}
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
  name: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800 },
  code: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500, marginTop: space[1] },
});
