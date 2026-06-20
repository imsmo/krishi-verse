// apps/mobile/src/app/(auth)/role.tsx · screen 04. Pick the role to act as. The selection is persisted (the app
// can hold several roles; this sets the active one) and drives which home the user lands on. The SERVER remains
// the authority on what the user may actually do — this only chooses the dashboard. Farmer is the built home
// this release; other roles are accepted and stored, and currently land on the farmer home (see index gate).
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ROLES, type AppRole } from '../../core/auth/role-switcher';
import { Button, ScreenScaffold, color, font, space, radius } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useAuth } from '../../core/auth/auth.store';

export default function RoleScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { selectRole } = useAuth();
  const [picked, setPicked] = useState<AppRole>('farmer');

  const onContinue = async () => {
    await selectRole(picked);
    router.replace('/(auth)/profile');
  };

  return (
    <ScreenScaffold
      title={t('role.title')}
      subtitle={t('role.subtitle')}
      footer={<Button title={t('role.continueAs', { role: t(`role.${picked}`) })} onPress={onContinue} />}
    >
      <View style={{ gap: space[3] }}>
        {ROLES.map((r) => {
          const active = r.role === picked;
          return (
            <Pressable key={r.role} onPress={() => setPicked(r.role)} style={[styles.row, active && styles.rowActive]} accessibilityRole="radio" accessibilityState={{ selected: active }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{t(r.i18nKey)}</Text>
                <Text style={styles.desc}>{t(r.descKey)}</Text>
              </View>
              <View style={[styles.radio, active && styles.radioOn]}>{active ? <Text style={styles.tick}>✓</Text> : null}</View>
            </Pressable>
          );
        })}
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[4], borderRadius: radius.lg, borderWidth: 1.5, borderColor: color.ink200, backgroundColor: color.card },
  rowActive: { borderColor: color.primary600, backgroundColor: color.primary50 },
  name: { fontFamily: font.body, fontSize: font.size.lg, fontWeight: font.weight.semibold, color: color.ink800 },
  desc: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500, marginTop: 2 },
  radio: { width: 26, height: 26, borderRadius: radius.pill, borderWidth: 2, borderColor: color.ink300, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: color.primary600, backgroundColor: color.primary600 },
  tick: { color: color.white, fontWeight: '700', fontSize: 14 },
});
