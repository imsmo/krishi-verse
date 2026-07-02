// apps/mobile/src/app/(farmer)/crop-hub.tsx · screen 104 "Crop Knowledge Hub". Thin screen (guide §3): quick
// entries (AI assistant / voice search / saved), a personalised crop-calendar block, and the REAL "Top tips"
// list (kind glyph, title, DERIVED read-time, chevron → detail). Reads cached tips → offline. Behind
// `tips_assistant`. Degrade-never-die.
// §13 gaps (no contract → rendered honestly, never faked): the design's crop-agronomy calendar is the bulk of
// this screen — a crop VARIETY ("Wheat (Lokwan)"), SEASON/duration ("Rabi · 120-130 days"), today's MANDI price,
// soil MOISTURE, a GROWTH STAGE ("4/6"), and a 7-stage GROWTH TIMELINE with per-stage dates + agronomy advisories.
// NONE of these have a farmer-facing contract: LandParcel carries no crop/variety/season/stage, and there is no
// crop-season / agronomy-calendar endpoint. So the calendar is shown as a single designed "coming soon" block —
// we NEVER fabricate a variety, a ₹ price, a moisture %, or a stage timeline. The Top-tips list IS real.
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import type { LearningResource } from '@krishi-verse/sdk-js';
import { Card, EmptyState, ScreenScaffold, SkeletonCard, color, font, space, radius } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { listTips } from '../../features/content/content.api';
import { readTimeMinutes } from '../../features/content/content';

function kindGlyph(kind: string): string {
  switch (kind) {
    case 'video': return '📹';
    case 'audio': return '🎧';
    case 'blog': return '📝';
    case 'post': return '📣';
    default: return '🌾';
  }
}

export default function CropHub() {
  const { t } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('tips_assistant');
  const [all, setAll] = useState<LearningResource[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => { const r = await listTips(); setAll(r.items); setLoading(false); }, []);
  useFocusEffect(useCallback(() => { if (enabled) { setLoading(true); load(); } }, [enabled, load]));
  const topTips = useMemo(() => all.slice(0, 6), [all]);

  if (!enabled) return <ScreenScaffold title={t('content.cropHub.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  return (
    <ScreenScaffold title={t('content.cropHub.title')}>
      <ScrollView contentContainerStyle={{ paddingBottom: space[6] }} showsVerticalScrollIndicator={false}>
        {/* Quick entries */}
        <View style={styles.quick}>
          <Pressable onPress={() => router.push('/(farmer)/assistant')} accessibilityRole="button" style={styles.tile}><Text style={styles.tileIcon}>🤖</Text><Text style={styles.tileLabel}>{t('content.assistant.title')}</Text></Pressable>
          <Pressable onPress={() => router.push('/(farmer)/voice-search')} accessibilityRole="button" style={styles.tile}><Text style={styles.tileIcon}>🎙️</Text><Text style={styles.tileLabel}>{t('content.voiceSearch.title')}</Text></Pressable>
          <Pressable onPress={() => router.push('/(farmer)/tips/saved')} accessibilityRole="button" style={styles.tile}><Text style={styles.tileIcon}>🔖</Text><Text style={styles.tileLabel}>{t('content.saved.title')}</Text></Pressable>
        </View>

        {/* Personalised crop calendar — §13: no crop-season/agronomy contract → designed coming-soon, never faked */}
        <Card style={styles.calendar}>
          <Text style={styles.calIcon}>🌱</Text>
          <Text style={styles.calTitle}>{t('content.cropHub.calendarTitle')}</Text>
          <Text style={styles.calSoon}>{t('content.cropHub.calendarSoon')}</Text>
          <Text style={styles.calDetail}>{t('content.cropHub.calendarDetail')}</Text>
          <Pressable onPress={() => router.push('/(farmer)/profile/farm')} accessibilityRole="button" style={styles.calBtn}>
            <Text style={styles.calBtnTxt}>{t('content.cropHub.addFarm')} →</Text>
          </Pressable>
        </Card>

        {/* Top tips — REAL tips (read-time derived; reads count omitted §13) */}
        <Text style={styles.section}>{t('content.cropHub.topTips')}</Text>
        {loading ? <SkeletonCard lines={5} /> : topTips.length === 0 ? (
          <EmptyState title={t('content.tips.empty.title')} message={t('content.tips.empty.message')} actionLabel={t('common.retry')} onAction={load} />
        ) : (
          <>
            {topTips.map((r) => (
              <Pressable key={r.id} onPress={() => router.push({ pathname: '/(farmer)/tips/[id]', params: { id: r.id } })} accessibilityRole="button">
                <Card style={styles.tipRow}>
                  <Text style={styles.tipGlyph}>{kindGlyph(r.kind)}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tipTitle} numberOfLines={2}>{r.title}</Text>
                    <Text style={styles.tipMeta}>🕐 {t('content.readTime', { n: readTimeMinutes(r.body) })}</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </Card>
              </Pressable>
            ))}
            <Pressable onPress={() => router.push('/(farmer)/tips')} accessibilityRole="button" style={styles.seeAllRow}>
              <Text style={styles.seeAll}>{t('content.cropHub.seeAll')} →</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  quick: { flexDirection: 'row', gap: space[2], marginBottom: space[3] },
  tile: { flex: 1, minHeight: 72, alignItems: 'center', justifyContent: 'center', backgroundColor: color.primary50, borderRadius: radius.md, paddingVertical: space[2] },
  tileIcon: { fontSize: 24 },
  tileLabel: { fontFamily: font.body, fontSize: font.size.xs, color: color.ink700, marginTop: space[1], textAlign: 'center' },

  calendar: { alignItems: 'center', marginBottom: space[4], paddingVertical: space[4] },
  calIcon: { fontSize: 36 },
  calTitle: { fontFamily: font.display, fontSize: font.size.lg, fontWeight: font.weight.bold, color: color.ink900, marginTop: space[2], textAlign: 'center' },
  calSoon: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink600, marginTop: space[1], textAlign: 'center' },
  calDetail: { fontFamily: font.body, fontSize: font.size.xs, color: color.ink400, marginTop: space[2], textAlign: 'center', lineHeight: 18 },
  calBtn: { marginTop: space[3], minHeight: 44, justifyContent: 'center', paddingHorizontal: space[4], borderRadius: radius.pill, borderWidth: 1.5, borderColor: color.primary600 },
  calBtnTxt: { fontFamily: font.body, fontSize: font.size.sm, fontWeight: font.weight.semibold, color: color.primary700 },

  section: { fontFamily: font.display, fontSize: font.size.lg, fontWeight: font.weight.bold, color: color.ink900, marginBottom: space[2] },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], marginBottom: space[2] },
  tipGlyph: { fontSize: 26, width: 36, textAlign: 'center' },
  tipTitle: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800, lineHeight: 20 },
  tipMeta: { fontFamily: font.body, fontSize: font.size.xs, color: color.ink500, marginTop: 2 },
  chevron: { fontFamily: font.body, fontSize: font.size.lg, color: color.ink400 },
  seeAllRow: { minHeight: 44, justifyContent: 'center', alignItems: 'center', marginTop: space[1] },
  seeAll: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.primary700 },
});
