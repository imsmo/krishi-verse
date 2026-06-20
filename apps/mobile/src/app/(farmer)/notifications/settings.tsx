// apps/mobile/src/app/(farmer)/notifications/settings.tsx · screen 171 (notification settings). Per event×channel
// opt-in/out toggles + quiet hours. Thin screen over features/notifications. A mandatory event can't be disabled
// (server throws → we revert the toggle). Quiet hours validated as HH:MM client-side (server re-validates).
// Behind the `notifications` flag. Degrade-never-die.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { NotificationPreference } from '@krishi-verse/sdk-js';
import { Button, Card, EmptyState, Input, ScreenScaffold, SkeletonCard, Toggle, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { getPreferences, setPreferences, getQuietHours, setQuietHours } from '../../../features/notifications/notifications.api';
import { hhmmToMinutes } from '../../../core/push/quiet-hours';
import { setQuietWindow } from '../../../core/push/push';

export default function NotificationSettings() {
  const { t } = useTranslation();
  const enabled = useFlag('notifications');
  const [prefs, setPrefs] = useState<NotificationPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [timeErr, setTimeErr] = useState<string | undefined>();
  const [savedMsg, setSavedMsg] = useState<string | undefined>();

  const load = useCallback(async () => {
    const [p, q] = await Promise.all([getPreferences(), getQuietHours()]);
    setPrefs(p);
    if (q) { setFrom(q.starts); setTo(q.ends); }
    setLoading(false);
  }, []);
  useEffect(() => { if (enabled) load(); }, [enabled, load]);

  const onToggle = async (idx: number, value: boolean) => {
    const prev = prefs;
    const next = prefs.map((p, i) => (i === idx ? { ...p, isEnabled: value } : p));
    setPrefs(next); // optimistic
    try { await setPreferences([next[idx]]); }
    catch { setPrefs(prev); } // mandatory event / failure → revert (degrade)
  };

  const onSaveQuiet = async () => {
    if (hhmmToMinutes(from) === null || hhmmToMinutes(to) === null) { setTimeErr(t('prefs.invalidTime')); return; }
    setTimeErr(undefined); setSavedMsg(undefined);
    try {
      const q = await setQuietHours({ starts: from, ends: to, timezone: 'Asia/Kolkata' });
      setQuietWindow({ starts: q.starts, ends: q.ends }); // honor locally for foreground display
      setSavedMsg(t('prefs.saved'));
    } catch { setTimeErr(t('common.error.generic')); }
  };

  if (!enabled) return <ScreenScaffold title={t('notifications.settings')}><EmptyState title={t('notifications.unavailable')} /></ScreenScaffold>;

  return (
    <ScreenScaffold title={t('notifications.settings')}>
      {loading ? <SkeletonCard lines={4} /> : (
        <>
          <Text style={styles.section}>{t('prefs.title')}</Text>
          <Card>
            {prefs.length === 0 ? <Text style={styles.empty}>{t('prefs.empty')}</Text> : prefs.map((p, i) => (
              <Toggle key={`${p.eventCode}:${p.channel}`} label={p.eventCode} hint={p.channel} value={p.isEnabled} onValueChange={(v) => onToggle(i, v)} />
            ))}
          </Card>

          <Text style={styles.section}>{t('prefs.quietHours')}</Text>
          <Text style={styles.hint}>{t('prefs.quietHint')}</Text>
          <View style={{ flexDirection: 'row', gap: space[3], marginTop: space[2] }}>
            <View style={{ flex: 1 }}><Input label={t('prefs.quietFrom')} value={from} onChangeText={setFrom} placeholder="22:00" maxLength={5} /></View>
            <View style={{ flex: 1 }}><Input label={t('prefs.quietTo')} value={to} onChangeText={setTo} placeholder="06:00" maxLength={5} error={timeErr} /></View>
          </View>
          <View style={{ marginTop: space[4] }}><Button title={t('prefs.save')} onPress={onSaveQuiet} fullWidth={false} /></View>
          {savedMsg ? <Text style={styles.saved}>{savedMsg}</Text> : null}
        </>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  section: { fontFamily: font.body, fontSize: font.size.lg, fontWeight: font.weight.semibold, color: color.ink700, marginTop: space[5], marginBottom: space[2] },
  hint: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500 },
  empty: { fontFamily: font.body, fontSize: font.size.md, color: color.ink500 },
  saved: { fontFamily: font.body, fontSize: font.size.md, color: color.successDark, marginTop: space[3] },
});
