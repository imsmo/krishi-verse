// apps/mobile/src/app/(auth)/role.tsx · screen 04 (Choose Role) — rebuilt to match the Phase-1 design
// (Krishi_Verse_Design_System/screens/04-role.html): a back-button app-bar titled "Choose Your Role", a hero
// ("How will you use Krishi-Verse?" + helper), five role cards each with a gradient icon tile, the English name
// with its Devanagari vernacular beside it, a one-line description, and a chevron; the selected card gets the
// green border + tint. A pinned "Continue as <role>" CTA carries the pick forward.
// The selection is persisted (the account can hold several roles; this sets the ACTIVE one) and only drives
// navigation/which dashboard to show — the SERVER remains the sole authority on what the user may actually do
// (§4). Copy via i18n (hi/en/gu); tokens-only; ≥48px targets; a11y radio semantics.
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ROLES, type AppRole, type RoleDef } from '../../core/auth/role-switcher';
import { Button, Icon, IconBadge, type IconName, color, font, space, radius, shadow } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useAuth } from '../../core/auth/auth.store';

// The five roles shown on this screen, IN THE DESIGN'S ORDER, each with its glyph + gradient (verbatim from the
// 04-role design's .role-icon.* tones, mapped to theme tokens where they exist; tenant purple is a design
// artwork tone with no token). `role` keys into ROLES for the i18n + navigation contract.
interface RoleCard { role: AppRole; icon: IconName; from: string; to: string; }
const ROLE_CARDS: readonly RoleCard[] = [
  { role: 'farmer', icon: 'sprout', from: color.primary500, to: color.primary600 },
  { role: 'buyer', icon: 'bag', from: color.accent400, to: color.accent600 },
  { role: 'trader', icon: 'truck', from: color.info, to: color.infoDark },
  { role: 'owner', icon: 'building', from: '#6c3483', to: '#50265f' },
  { role: 'ambassador', icon: 'user-check', from: color.danger, to: color.dangerDark },
];

const DEF: Record<AppRole, RoleDef> = Object.fromEntries(ROLES.map((r) => [r.role, r])) as Record<AppRole, RoleDef>;

export default function RoleScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { selectRole } = useAuth();
  const [picked, setPicked] = useState<AppRole>('farmer');
  const [busy, setBusy] = useState(false);

  const onContinue = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await selectRole(picked);
      router.replace('/(auth)/profile');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* App bar: back + centred title */}
      <View style={styles.appbar}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.back')} hitSlop={8} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={color.ink700} />
        </Pressable>
        <Text style={styles.appbarTitle}>{t('role.title')}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <Text style={styles.heading}>{t('role.heading')}</Text>
        <Text style={styles.sub}>{t('role.subtitle')}</Text>

        {/* Role cards */}
        <View style={styles.list}>
          {ROLE_CARDS.map((c) => {
            const def = DEF[c.role];
            const active = c.role === picked;
            return (
              <Pressable
                key={c.role}
                onPress={() => setPicked(c.role)}
                style={[styles.card, active && styles.cardActive]}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${t(def.i18nKey)} — ${t(def.descKey)}`}
              >
                <IconBadge name={c.icon} from={c.from} to={c.to} />
                <View style={styles.body}>
                  <Text style={styles.name}>
                    {t(def.i18nKey)}
                    <Text style={styles.vern}>  {t(`role.vern.${c.role}`)}</Text>
                  </Text>
                  <Text style={styles.desc}>{t(def.descKey)}</Text>
                </View>
                <Icon name="chevron-right" size={20} color={active ? color.primary600 : color.ink400} />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <Button title={t('role.continueAs', { role: t(DEF[picked].i18nKey) })} size="lg" onPress={onContinue} loading={busy} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.page },

  appbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[2] },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: color.card, borderWidth: 1, borderColor: color.earth200 },
  appbarTitle: { fontFamily: font.display, fontSize: font.size.lg, fontWeight: font.weight.bold, color: color.ink800 },

  scroll: { paddingHorizontal: space[5], paddingTop: space[3], paddingBottom: space[4] },
  heading: { fontFamily: font.display, fontSize: font.size['2xl'], fontWeight: font.weight.bold, color: color.ink800, letterSpacing: -0.3 },
  sub: { fontFamily: font.body, fontSize: font.size.md, color: color.ink500, marginTop: space[1] },

  list: { gap: space[3], marginTop: space[5] },
  card: { flexDirection: 'row', alignItems: 'center', gap: space[4], padding: space[4], borderRadius: radius.lg, borderWidth: 2, borderColor: color.earth200, backgroundColor: color.card },
  cardActive: { borderColor: color.primary600, backgroundColor: color.primary50, ...shadow.card },
  body: { flex: 1 },
  name: { fontFamily: font.body, fontSize: font.size.lg, fontWeight: font.weight.bold, color: color.ink800, lineHeight: 22 },
  vern: { fontFamily: font.vernacular, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.primary700 },
  desc: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500, marginTop: 2 },

  actions: { paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[4] },
});
