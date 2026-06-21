// apps/mobile/src/app/(system)/data-download.tsx · screen 179 (DPDP data export). Thin screen (guide §3): request a
// copy of your data; the server compiles it and notifies you (SMS/email). The app NEVER builds the export itself.
// Behind `system_screens`. Degrade-never-die. NOTE: the export endpoint isn't live yet → an honest "unavailable"
// message until it lands (flagged).
import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button, Card, EmptyState, ScreenScaffold, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { requestDataExport } from '../../features/system/system.api';

export default function DataDownload() {
  const { t } = useTranslation();
  const enabled = useFlag('system_screens');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<'idle' | 'ok' | 'unavailable'>('idle');

  if (!enabled) return <ScreenScaffold title={t('system.dataDownload.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const request = async () => {
    setBusy(true);
    const r = await requestDataExport();
    setResult(r.ok ? 'ok' : 'unavailable');
    setBusy(false);
  };

  return (
    <ScreenScaffold title={t('system.dataDownload.title')}>
      <Card>
        <Text style={styles.body}>{t('system.dataDownload.intro')}</Text>
        {result === 'ok' ? <Text style={styles.ok}>{t('system.dataDownload.submitted')}</Text>
          : result === 'unavailable' ? <Text style={styles.warn}>{t('system.dataDownload.unavailable')}</Text> : null}
        <View style={{ marginTop: space[4] }}>
          <Button title={t('system.dataDownload.request')} loading={busy} disabled={result === 'ok'} onPress={request} />
        </View>
      </Card>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  body: { fontFamily: font.body, fontSize: font.size.md, color: color.ink700, lineHeight: 22 },
  ok: { fontFamily: font.body, fontSize: font.size.sm, color: color.success, marginTop: space[3] },
  warn: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500, marginTop: space[3] },
});
