// apps/mobile/src/app/(farmer)/weather/settings.tsx · screen 118 (weather settings). Thin screen (guide §3): shows
// the region weather is sourced from (the farmer's default saved address) and routes to notification settings for
// push prefs. Behind `mandi_weather`. Degrade-never-die.
// NOTE: there is no per-user "weather region/prefs" persistence endpoint — region follows the saved address, and
// push delivery prefs live in the shared notification settings (P-04). Flagged; not faked.
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Button, Card, EmptyState, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { defaultRegionId } from '../../../features/market/market.api';

export default function WeatherSettings() {
  const { t } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('mandi_weather');
  const notifOn = useFlag('notifications');
  const [region, setRegion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => { setRegion(await defaultRegionId()); setLoading(false); }, []);
  useFocusEffect(useCallback(() => { if (enabled) { setLoading(true); load(); } }, [enabled, load]));

  if (!enabled) return <ScreenScaffold title={t('weather.settings.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  return (
    <ScreenScaffold title={t('weather.settings.title')}>
      {loading ? <SkeletonCard lines={3} /> : (
        <>
          <Card>
            <View style={styles.row}>
              <Text style={styles.k}>{t('weather.settings.region')}</Text>
              <Text style={styles.v}>{region ? region.slice(0, 8).toUpperCase() : t('weather.settings.none')}</Text>
            </View>
            <Text style={styles.note}>{t('weather.settings.regionNote')}</Text>
          </Card>
          <View style={styles.actions}>
            <Button title={t('weather.settings.changeAddress')} variant="outline" onPress={() => router.push('/(farmer)/profile')} />
            {notifOn ? <Button title={t('weather.settings.pushPrefs')} variant="outline" onPress={() => router.push('/(farmer)/notifications/settings')} /> : null}
          </View>
        </>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  k: { fontFamily: font.body, fontSize: font.size.md, color: color.ink500 },
  v: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800 },
  note: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink400, marginTop: space[2] },
  actions: { marginTop: space[4], gap: space[3] },
});
