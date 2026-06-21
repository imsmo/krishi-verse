// apps/mobile/src/app/(farmer)/tips/[id].tsx · screen 101 (tip detail). Thin screen (guide §3): a tip's title,
// body, and asset link. No get-by-id endpoint → reads the cached list and finds it. A bookmark toggle persists a
// device-local snapshot (no server bookmark endpoint — flagged). Behind `tips_assistant`. Degrade-never-die.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Linking, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { LearningResource } from '@krishi-verse/sdk-js';
import { Button, Card, EmptyState, StatusPill, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { getTip, tipMediaUrl, loadSavedTips, persistSavedTips } from '../../../features/content/content.api';
import { kindLabelKey, kindTone, tipSnapshot, toggleSaved, isSaved, type TipSnapshot } from '../../../features/content/content';

export default function TipDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const enabled = useFlag('tips_assistant');
  const [tip, setTip] = useState<LearningResource | null>(null);
  const [saved, setSaved] = useState<TipSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) { setLoading(false); return; }
    setLoading(true);
    const [r, s] = await Promise.all([getTip(id), loadSavedTips()]);
    setTip(r); setSaved(s); setLoading(false);
  }, [id]);
  useEffect(() => { if (enabled) load(); }, [enabled, load]);

  if (!enabled) return <ScreenScaffold title={t('content.tips.detailTitle')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const bookmarked = tip ? isSaved(saved, tip.id) : false;
  const toggle = async () => {
    if (!tip) return;
    const next = toggleSaved(saved, tipSnapshot(tip));
    setSaved(next);
    await persistSavedTips(next);
  };
  const openAsset = async () => {
    if (!tip) return;
    let url = tip.externalUrl;
    if (!url && tip.mediaId) url = await tipMediaUrl(tip.mediaId);
    if (!url) { Alert.alert(t('content.tips.detailTitle'), t('content.tips.noAsset')); return; }
    if (/^https:\/\//i.test(url)) Linking.openURL(url).catch(() => Alert.alert(t('content.tips.detailTitle'), t('common.error.generic')));
    else Alert.alert(t('content.tips.detailTitle'), t('content.tips.noAsset'));
  };

  return (
    <ScreenScaffold title={t('content.tips.detailTitle')}>
      {loading ? <SkeletonCard lines={6} /> : !tip ? (
        <EmptyState title={t('content.tips.unavailable')} actionLabel={t('common.retry')} onAction={load} />
      ) : (
        <Card>
          <View style={styles.head}>
            <Text style={styles.title}>{tip.title}</Text>
            <StatusPill label={t(kindLabelKey(tip.kind))} tone={kindTone(tip.kind)} />
          </View>
          {tip.body ? <Text style={styles.body}>{tip.body}</Text> : null}
          <View style={styles.actions}>
            {tip.externalUrl || tip.mediaId ? <Button title={t('content.tips.open')} variant="outline" onPress={openAsset} /> : null}
            <Button title={bookmarked ? t('content.saved.remove') : t('content.saved.add')} variant={bookmarked ? 'outline' : 'primary'} onPress={toggle} />
          </View>
        </Card>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space[3], marginBottom: space[2] },
  title: { flex: 1, fontFamily: font.body, fontSize: font.size.lg, fontWeight: font.weight.bold, color: color.ink900 },
  body: { fontFamily: font.body, fontSize: font.size.md, color: color.ink700, lineHeight: 22 },
  actions: { marginTop: space[4], gap: space[3] },
});
