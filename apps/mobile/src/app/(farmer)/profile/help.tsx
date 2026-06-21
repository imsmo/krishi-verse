// apps/mobile/src/app/(farmer)/profile/help.tsx · screen 123 (help). Thin screen (guide §3): the caller's own
// support tickets (keyset) with status + SLA read-out + CSAT on a resolved ticket; CTA to raise a complaint.
// Behind `farmer_profile`. Degrade-never-die.
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import type { SupportTicket } from '@krishi-verse/sdk-js';
import { formatDate } from '@krishi-verse/i18n';
import { Button, Card, EmptyState, StatusPill, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { myTickets, rateTicket } from '../../../features/profile/profile.api';
import { ticketStatusTone, severityTone, resolutionSlaState, canRateCsat } from '../../../features/profile/profile';

export default function Help() {
  const { t, lang } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('farmer_profile');
  const [items, setItems] = useState<SupportTicket[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [paging, setPaging] = useState(false);

  const load = useCallback(async () => { const r = await myTickets(); setItems(r.items); setCursor(r.nextCursor); setLoading(false); }, []);
  useFocusEffect(useCallback(() => { if (enabled) { setLoading(true); load(); } }, [enabled, load]));

  const more = useCallback(async () => {
    if (!cursor || paging) return; setPaging(true);
    try { const r = await myTickets(cursor); setItems((p) => [...p, ...r.items]); setCursor(r.nextCursor); } finally { setPaging(false); }
  }, [cursor, paging]);

  if (!enabled) return <ScreenScaffold title={t('profile.help')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const rate = async (ticket: SupportTicket, score: number) => {
    try { await rateTicket(ticket.id, score); await load(); }
    catch { Alert.alert(t('profile.help'), t('common.error.generic')); }
  };

  return (
    <ScreenScaffold title={t('profile.help')} footer={<View style={{ paddingVertical: space[1] }}><Button title={t('profile.complaint.cta')} onPress={() => router.push('/(farmer)/profile/complaint')} /></View>}>
      {loading ? <SkeletonCard lines={5} /> : items.length === 0 ? (
        <EmptyState title={t('profile.help.empty.title')} message={t('profile.help.empty.message')} actionLabel={t('profile.complaint.cta')} onAction={() => router.push('/(farmer)/profile/complaint')} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(tk) => tk.id}
          renderItem={({ item }) => {
            const sla = resolutionSlaState(item);
            return (
              <Card style={styles.card}>
                <View style={styles.row}>
                  <Text style={styles.no}>{item.ticketNo}</Text>
                  <StatusPill label={t(`profile.help.status.${item.status}`, { defaultValue: item.status })} tone={ticketStatusTone(item.status)} />
                </View>
                {item.subject ? <Text style={styles.subject} numberOfLines={2}>{item.subject}</Text> : null}
                <View style={[styles.row, { marginTop: space[2] }]}>
                  <StatusPill label={item.severity} tone={severityTone(item.severity)} />
                  {sla !== 'none' ? <Text style={[styles.sla, sla === 'breached' && styles.slaBad]}>{t(`profile.help.sla.${sla}`)}{item.slaResolutionDue ? ` · ${safeDate(item.slaResolutionDue, lang)}` : ''}</Text> : null}
                </View>
                {canRateCsat(item.status) && item.csatScore == null ? (
                  <View style={styles.csat}>
                    <Text style={styles.csatLabel}>{t('profile.help.rate')}</Text>
                    <View style={styles.stars}>{[1, 2, 3, 4, 5].map((s) => <Pressable key={s} onPress={() => rate(item, s)} accessibilityRole="button" accessibilityLabel={`${s}`} style={styles.star}><Text style={styles.starText}>☆{s}</Text></Pressable>)}</View>
                  </View>
                ) : item.csatScore != null ? <Text style={styles.rated}>{t('profile.help.rated', { n: item.csatScore })}</Text> : null}
              </Card>
            );
          }}
          onEndReached={more}
          onEndReachedThreshold={0.5}
          ListFooterComponent={paging ? <SkeletonCard lines={1} /> : null}
          contentContainerStyle={{ paddingBottom: space[6] }}
        />
      )}
    </ScreenScaffold>
  );
}

function safeDate(value: string, langCode: string): string { try { return formatDate(value, langCode); } catch { return value; } }

const styles = StyleSheet.create({
  card: { marginBottom: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  no: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800 },
  subject: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink600, marginTop: space[1] },
  sla: { fontFamily: font.body, fontSize: font.size.xs, color: color.ink500 },
  slaBad: { color: color.danger },
  csat: { marginTop: space[3] },
  csatLabel: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500, marginBottom: space[1] },
  stars: { flexDirection: 'row', gap: space[2] },
  star: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' },
  starText: { fontFamily: font.body, fontSize: font.size.md, color: color.primary700 },
  rated: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500, marginTop: space[2] },
});
