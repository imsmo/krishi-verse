// apps/mobile/src/app/(ambassador)/visit-log.tsx · screen 164 (visit log — geo). Thin screen (guide §3): captures
// the ambassador's current GPS fix (core/location, JIT permission, degrade) to log a field visit. FLAGGED: the
// ambassadors module has NO visit-log endpoint yet, so the fix is captured + shown but NOT posted to a fabricated
// endpoint — we surface "recording coming soon" rather than fake a write. The geo capture is real + reusable for
// when the contract lands. Behind `ambassador_app`. Location is read once (no continuous polling) and never logged.
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Button, Card, EmptyState, ScreenScaffold, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { getCurrentFix, distanceParts } from '../../core/location';

export default function VisitLog() {
  const { t } = useTranslation();
  const enabled = useFlag('ambassador_app');
  const [fix, setFix] = useState<{ lat: number; lng: number; accuracyM?: number | null } | null>(null);
  const [busy, setBusy] = useState(false);

  const capture = useCallback(async () => {
    setBusy(true);
    try {
      const r = await getCurrentFix();
      if (r.ok && r.fix) setFix(r.fix);
      else Alert.alert(t('amb.visit.title'), t(`worker.clockIn.gps.${r.reason ?? 'error'}`));
    } finally { setBusy(false); }
  }, [t]);

  if (!enabled) return <ScreenScaffold title={t('amb.visit.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const acc = fix?.accuracyM != null ? distanceParts(fix.accuracyM) : null;

  return (
    <ScreenScaffold title={t('amb.visit.title')} footer={<Button title={t('amb.visit.capture')} onPress={capture} loading={busy} />}>
      <Card>
        <Text style={styles.h}>{t('amb.visit.heading')}</Text>
        <Text style={styles.body}>{t('amb.visit.body')}</Text>
        {fix ? (
          <View style={{ marginTop: space[3] }}>
            <Text style={styles.coords}>{t('hire.book.located', { lat: fix.lat.toFixed(5), lng: fix.lng.toFixed(5) })}</Text>
            {acc ? <Text style={styles.acc}>± {acc.value} {t(`worker.unit.${acc.unit}`)}</Text> : null}
            <Text style={styles.note}>{t('amb.visit.comingSoon')}</Text>
          </View>
        ) : null}
      </Card>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  h: { fontFamily: font.display, fontSize: font.size.lg, fontWeight: font.weight.bold, color: color.ink800, marginBottom: space[2] },
  body: { fontFamily: font.body, fontSize: font.size.md, color: color.ink600 },
  coords: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800 },
  acc: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500, marginTop: space[1] },
  note: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink400, marginTop: space[3] },
});
