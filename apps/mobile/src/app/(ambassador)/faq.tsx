// apps/mobile/src/app/(ambassador)/faq.tsx · screen 167 (FAQ / help). Thin screen (guide §3): in-app help content
// (localized app copy, not server data) as expandable Q&A. Behind `ambassador_training`.
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Card, EmptyState, ScreenScaffold, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';

const FAQ_KEYS = ['referral', 'commission', 'withdraw', 'training'] as const;

export default function Faq() {
  const { t } = useTranslation();
  const enabled = useFlag('ambassador_training');
  const [open, setOpen] = useState<string | null>(null);
  if (!enabled) return <ScreenScaffold title={t('amb.faq.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;
  return (
    <ScreenScaffold title={t('amb.faq.title')}>
      {FAQ_KEYS.map((k) => {
        const isOpen = open === k;
        return (
          <Pressable key={k} onPress={() => setOpen(isOpen ? null : k)} accessibilityRole="button" accessibilityState={{ expanded: isOpen }}>
            <Card style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.q}>{t(`amb.faq.${k}.q`)}</Text>
                <Text style={styles.chev}>{isOpen ? '−' : '+'}</Text>
              </View>
              {isOpen ? <Text style={styles.a}>{t(`amb.faq.${k}.a`)}</Text> : null}
            </Card>
          </Pressable>
        );
      })}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] },
  q: { flex: 1, fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800 },
  chev: { fontFamily: font.body, fontSize: font.size.lg, color: color.ink500 },
  a: { fontFamily: font.body, fontSize: font.size.md, color: color.ink600, marginTop: space[2] },
});
