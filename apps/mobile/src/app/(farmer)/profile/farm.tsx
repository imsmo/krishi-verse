// apps/mobile/src/app/(farmer)/profile/farm.tsx · screen 120 (farm details). Thin screen (guide §3): list the
// caller's own land parcels (keyset) + register a new one (area + unit + optional survey no, idempotent). Server
// verifies parcels (verificationStatus shown read-only). Behind `farmer_profile`. Degrade-never-die.
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { LandParcel } from '@krishi-verse/sdk-js';
import { Button, Card, Input, EmptyState, StatusPill, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { myParcels, registerParcel } from '../../../features/profile/profile.api';
import { buildParcelDraft, parcelAreaLabel, parcelStatusTone } from '../../../features/profile/profile';

export default function FarmDetails() {
  const { t } = useTranslation();
  const enabled = useFlag('farmer_profile');
  const [items, setItems] = useState<LandParcel[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [paging, setPaging] = useState(false);
  const [areaValue, setAreaValue] = useState('');
  const [surveyNo, setSurveyNo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const load = useCallback(async () => { const r = await myParcels(); setItems(r.items); setCursor(r.nextCursor); setLoading(false); }, []);
  useFocusEffect(useCallback(() => { if (enabled) { setLoading(true); load(); } }, [enabled, load]));

  const more = useCallback(async () => {
    if (!cursor || paging) return; setPaging(true);
    try { const r = await myParcels(cursor); setItems((p) => [...p, ...r.items]); setCursor(r.nextCursor); } finally { setPaging(false); }
  }, [cursor, paging]);

  if (!enabled) return <ScreenScaffold title={t('profile.farmDetails')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const add = async () => {
    const draft = buildParcelDraft({ areaValue, surveyNo });
    if (!draft.ok || !draft.input) { setError(t('profile.farm.areaInvalid')); return; }
    setSaving(true); setError(undefined);
    try { await registerParcel(draft.input); setAreaValue(''); setSurveyNo(''); await load(); }
    catch { Alert.alert(t('profile.farmDetails'), t('profile.farm.failed')); }
    finally { setSaving(false); }
  };

  return (
    <ScreenScaffold title={t('profile.farmDetails')}>
      <Card style={styles.form}>
        <Text style={styles.h}>{t('profile.farm.addTitle')}</Text>
        <Input label={t('profile.farm.area')} value={areaValue} onChangeText={setAreaValue} keyboardType="decimal-pad" maxLength={11} error={error} />
        <Input label={t('profile.farm.surveyNo')} value={surveyNo} onChangeText={setSurveyNo} maxLength={60} />
        <View style={{ marginTop: space[2] }}><Button title={t('profile.farm.add')} loading={saving} onPress={add} /></View>
      </Card>

      {loading ? <SkeletonCard lines={4} /> : items.length === 0 ? (
        <EmptyState title={t('profile.farm.empty.title')} message={t('profile.farm.empty.message')} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.area}>{parcelAreaLabel(item)}</Text>
                <StatusPill label={t(`profile.farm.status.${item.verificationStatus}`, { defaultValue: item.verificationStatus })} tone={parcelStatusTone(item.verificationStatus)} />
              </View>
              {item.surveyNo ? <Text style={styles.meta}>{t('profile.farm.surveyNo')}: {item.surveyNo}</Text> : null}
            </Card>
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

const styles = StyleSheet.create({
  form: { marginBottom: space[3] },
  h: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800, marginBottom: space[2] },
  card: { marginBottom: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  area: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800 },
  meta: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500, marginTop: space[1] },
});
