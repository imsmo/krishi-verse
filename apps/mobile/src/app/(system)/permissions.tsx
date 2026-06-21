// apps/mobile/src/app/(system)/permissions.tsx · screen 185 (permissions). Thin screen (guide §3): explain WHY each
// permission is requested (store-compliant rationale, §8) + a button to open the OS app settings. Static (no
// backend) — renders regardless of flags. Degrade-never-die.
import React from 'react';
import { View, Text, StyleSheet, Linking, Platform } from 'react-native';
import { Button, Card, ScreenScaffold, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { PERMISSIONS, permissionTitleKey, permissionWhyKey } from '../../features/system/system';

export default function Permissions() {
  const { t } = useTranslation();
  const openSettings = () => { Linking.openSettings?.().catch(() => { /* best-effort */ }); };

  return (
    <ScreenScaffold title={t('system.permissions.title')}>
      <Text style={styles.note}>{t('system.permissions.intro')}</Text>
      <View style={{ gap: space[2] }}>
        {PERMISSIONS.map((p) => (
          <Card key={p.key}>
            <View style={styles.row}>
              <Text style={styles.icon} accessibilityElementsHidden importantForAccessibility="no">{p.icon}</Text>
              <View style={styles.texts}>
                <Text style={styles.title}>{t(permissionTitleKey(p.key))}</Text>
                <Text style={styles.why}>{t(permissionWhyKey(p.key))}</Text>
              </View>
            </View>
          </Card>
        ))}
      </View>
      <View style={{ marginTop: space[4] }}>
        <Button title={t('system.permissions.open')} variant="outline" onPress={openSettings} />
      </View>
      <Text style={styles.foot}>{Platform.OS === 'ios' ? t('system.permissions.iosNote') : t('system.permissions.androidNote')}</Text>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  note: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500, marginBottom: space[3] },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3] },
  icon: { fontSize: 24 },
  texts: { flex: 1 },
  title: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800 },
  why: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500, marginTop: space[1] },
  foot: { fontFamily: font.body, fontSize: font.size.xs, color: color.ink400, marginTop: space[3] },
});
