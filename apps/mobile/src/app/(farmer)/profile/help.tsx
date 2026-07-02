// apps/mobile/src/app/(farmer)/profile/help.tsx · screen 123 "Help & Support". Thin screen (guide §3): a help hub —
// support channels (Ask AI / raise a request / call / report), popular questions + topic chips (route to the AI
// assistant), and the caller's REAL support requests (tickets — status + CSAT on a resolved one). Behind
// `farmer_profile`. Degrade-never-die.
// §13 gaps (no contract → rendered honestly, never faked):
//  • The CALL helpline number ("1800-XXX-1234") isn't in app config/contract → shown as a coming-soon channel,
//    never a fabricated working number wired to tel:.
//  • A live "Chat with support" presence + "9 AM-7 PM" window has no contract → the channel raises a real support
//    request (complaint) rather than implying a live agent is online.
//  • "Talk to Vikas — your ambassador · Available now · Petlad cluster" — there is no farmer→ambassador assignment
//    contract → a coming-soon block, never a fabricated ambassador name/availability.
import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import type { SupportTicket } from '@krishi-verse/sdk-js';
import { Card, EmptyState, StatusPill, ScreenScaffold, SkeletonCard, color, font, space, radius } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { myTickets, rateTicket } from '../../../features/profile/profile.api';
import { ticketStatusTone, canRateCsat } from '../../../features/profile/profile';

const FAQS = ['payout', 'rejected', 'rating', 'kyc', 'priceBand'] as const;
const TOPICS = ['selling', 'payments', 'workers', 'auctions', 'schemes', 'app'] as const;

export default function Help() {
  const { t } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('farmer_profile');
  const [items, setItems] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => { const r = await myTickets(); setItems(r.items); setLoading(false); }, []);
  useFocusEffect(useCallback(() => { if (enabled) { setLoading(true); load(); } else setLoading(false); }, [enabled, load]));

  if (!enabled) return <ScreenScaffold title={t('profile.help')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const rate = async (ticket: SupportTicket, score: number) => {
    try { await rateTicket(ticket.id, score); await load(); }
    catch { Alert.alert(t('profile.help'), t('common.error.generic')); }
  };
  const askTopic = () => router.push('/(farmer)/assistant');

  return (
    <ScreenScaffold title={t('profile.help')}>
      {/* Channels */}
      <View style={styles.channels}>
        <Channel icon="🤖" title={t('profile.help.askAi')} sub={t('profile.help.askAiSub')} onPress={() => router.push('/(farmer)/assistant')} />
        <Channel icon="💬" title={t('profile.help.chat')} sub={t('profile.help.chatSub')} onPress={() => router.push('/(farmer)/profile/complaint')} />
        <Channel icon="📞" title={t('profile.help.call')} sub={t('profile.help.callSoon')} disabled />
        <Channel icon="⚠" title={t('profile.help.report')} sub={t('profile.help.reportSub')} onPress={() => router.push('/(farmer)/profile/complaint')} />
      </View>

      {/* Ambassador — §13 */}
      <Card style={styles.amb}>
        <Text style={styles.ambTitle}>{t('profile.help.ambassadorTitle')}</Text>
        <Text style={styles.ambSoon}>{t('profile.help.ambassadorSoon')}</Text>
      </Card>

      {/* Popular questions */}
      <Text style={styles.section}>{t('profile.help.popularQ')}</Text>
      <Card>
        {FAQS.map((f, i) => (
          <Pressable key={f} onPress={askTopic} accessibilityRole="button" style={[styles.faqRow, i > 0 && styles.divide]}>
            <Text style={styles.faqQ} numberOfLines={2}>{t(`profile.help.q.${f}`)}</Text>
            <Text style={styles.chev}>›</Text>
          </Pressable>
        ))}
      </Card>

      {/* Browse by topic */}
      <Text style={styles.section}>{t('profile.help.browseTopic')}</Text>
      <View style={styles.topics}>
        {TOPICS.map((tp) => (
          <Pressable key={tp} onPress={askTopic} accessibilityRole="button" style={styles.topicChip}><Text style={styles.topicTxt}>{t(`profile.help.topic.${tp}`)}</Text></Pressable>
        ))}
      </View>

      {/* My support requests (real) */}
      <Text style={styles.section}>{t('profile.help.myRequests')}</Text>
      {loading ? <SkeletonCard lines={3} /> : items.length === 0 ? (
        <Card><Text style={styles.muted}>{t('profile.help.empty.message')}</Text></Card>
      ) : items.map((item) => (
        <Card key={item.id} style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.no}>{item.ticketNo}</Text>
            <StatusPill label={t(`profile.help.status.${item.status}`, { defaultValue: item.status })} tone={ticketStatusTone(item.status)} />
          </View>
          {item.subject ? <Text style={styles.subject} numberOfLines={2}>{item.subject}</Text> : null}
          {canRateCsat(item.status) && item.csatScore == null ? (
            <View style={styles.csat}>
              <Text style={styles.csatLabel}>{t('profile.help.rate')}</Text>
              <View style={styles.stars}>{[1, 2, 3, 4, 5].map((s) => <Pressable key={s} onPress={() => rate(item, s)} accessibilityRole="button" accessibilityLabel={`${s}`} style={styles.star}><Text style={styles.starText}>☆{s}</Text></Pressable>)}</View>
            </View>
          ) : item.csatScore != null ? <Text style={styles.rated}>{t('profile.help.rated', { n: item.csatScore })}</Text> : null}
        </Card>
      ))}
    </ScreenScaffold>
  );
}

function Channel({ icon, title, sub, onPress, disabled }: { icon: string; title: string; sub: string; onPress?: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={[styles.channel, disabled && styles.channelOff]}>
      <Text style={styles.channelIcon}>{icon}</Text>
      <Text style={styles.channelTitle}>{title}</Text>
      <Text style={styles.channelSub} numberOfLines={1}>{sub}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  channels: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  channel: { width: '48%', flexGrow: 1, backgroundColor: color.card, borderWidth: 1, borderColor: color.ink100, borderRadius: radius.lg, padding: space[3], minHeight: 88 },
  channelOff: { opacity: 0.6 },
  channelIcon: { fontSize: 24 },
  channelTitle: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.bold, color: color.ink800, marginTop: space[1] },
  channelSub: { fontFamily: font.body, fontSize: font.size.xs, color: color.ink500, marginTop: 2 },
  amb: { marginTop: space[3] },
  ambTitle: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800 },
  ambSoon: { fontFamily: font.body, fontSize: font.size.xs, color: color.ink400, marginTop: space[1] },
  section: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.bold, color: color.ink700, marginTop: space[4], marginBottom: space[2] },
  faqRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, gap: space[3] },
  divide: { borderTopWidth: 1, borderTopColor: color.ink100 },
  faqQ: { flex: 1, fontFamily: font.body, fontSize: font.size.md, color: color.ink700 },
  chev: { fontFamily: font.body, fontSize: font.size.lg, color: color.ink400 },
  topics: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  topicChip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space[3], borderRadius: radius.pill, borderWidth: 1.5, borderColor: color.ink200, backgroundColor: color.card },
  topicTxt: { fontFamily: font.body, fontSize: font.size.sm, fontWeight: font.weight.semibold, color: color.ink700 },
  card: { marginBottom: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  no: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800 },
  subject: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink600, marginTop: space[1] },
  muted: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500 },
  csat: { marginTop: space[3] },
  csatLabel: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500, marginBottom: space[1] },
  stars: { flexDirection: 'row', gap: space[2] },
  star: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' },
  starText: { fontFamily: font.body, fontSize: font.size.md, color: color.primary700 },
  rated: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500, marginTop: space[2] },
});
