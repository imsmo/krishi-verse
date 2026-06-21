// apps/mobile/src/app/(farmer)/hire/sent.tsx · screen 47 (booking sent). Thin confirmation (guide §3): the
// booking was posted; workers will be offered + must confirm within the server's respond-by window. Behind
// `labour_hire`.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, ScreenScaffold, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';

export default function BookingSent() {
  const { bookingNo, id } = useLocalSearchParams<{ bookingNo?: string; id?: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <ScreenScaffold title={t('hire.sent.title')}>
      <Card>
        <Text style={styles.h}>✓ {t('hire.sent.heading')}</Text>
        {bookingNo ? <Text style={styles.no}>{t('worker.jobNo', { id: bookingNo })}</Text> : null}
        <Text style={styles.body}>{t('hire.sent.body')}</Text>
      </Card>
      <View style={{ marginTop: space[4], gap: space[3] }}>
        {id ? <Button title={t('hire.sent.view')} onPress={() => router.replace({ pathname: '/(farmer)/hire/booking/[id]', params: { id } })} /> : null}
        <Button title={t('hire.bookings.title')} variant="outline" onPress={() => router.replace('/(farmer)/hire/bookings')} />
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  h: { fontFamily: font.display, fontSize: font.size.xl, fontWeight: font.weight.bold, color: color.successDark, marginBottom: space[2] },
  no: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800, marginBottom: space[2] },
  body: { fontFamily: font.body, fontSize: font.size.md, color: color.ink600 },
});
