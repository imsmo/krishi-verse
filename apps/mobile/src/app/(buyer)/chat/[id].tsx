// apps/mobile/src/app/(buyer)/chat/[id].tsx · screen 98 "Chat with Seller". Thin screen (guide §3): a peer header
// (avatar + name + real ⭐ rating + masked-call), a pinned listing-context card (from the conversation's contextId),
// and the message thread (keyset, newest-first → inverted list) with day-divider system rows + per-bubble
// timestamps. Poll every 5s while focused (realtime-ish). Send text or an image (core/media compress+upload →
// attachmentMediaId; bytes never touch the API). Masked call bridges the two real numbers SERVER-SIDE — no number
// is shown. Behind `offers_chat`; membership server-enforced (non-participant → 404). Degrade-never-die.
// §13 gaps (no contract → rendered honestly, never faked):
//  • Seller NAME + avatar initials ("Ramesh Patel" / "RP"): no participant-name on the Conversation contract and
//    no public user-profile read → a generic "Seller" label + a person glyph; the ⭐ rating IS real (reviews
//    summary for the peer, derived from the listing's sellerUserId), shown only when there are ratings.
//  • "● Online" presence + "Ramesh is typing…": no presence/typing contract → omitted (never a fake status).
//  • Read ticks "✓✓": the Message contract has no delivery/read state → no read receipts are shown (we never
//    claim "read"); only the real send time is rendered per bubble. Image caption ("Moisture meter · 11.2%") isn't
//    on the contract → the attachment shows a neutral photo chip.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { Message, ListingCard } from '@krishi-verse/sdk-js';
import { SdkError } from '@krishi-verse/sdk-js';
import { Input, Button, EmptyState, MoneyText, ScreenScaffold, SkeletonCard, color, font, space, radius } from '@krishi-verse/ui-native';
import { formatDate } from '@krishi-verse/i18n';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { useAuth } from '../../../core/auth/auth.store';
import { listMessages, getConversation, postText, postAttachment, startMaskedCall, markConversationRead } from '../../../features/messaging/messaging.api';
import { getPublicListing, sellerSummary } from '../../../features/buyer/browse.api';
import { presentMessage, canSend, normalizeBody, isDayBoundary } from '../../../features/messaging/message-view';
import { MessageBubble } from '../../../features/messaging/components/MessageBubble';
import { pickFromGallery, captureFromCamera, uploadPickedImage, type PickedImage } from '../../../core/media';

const POLL_MS = 5000;

export default function ChatThread() {
  const { id, peerId } = useLocalSearchParams<{ id: string; peerId?: string }>();
  const { t, lang } = useTranslation();
  const { state } = useAuth();
  const myId = state.profile?.id ?? '';
  const enabled = useFlag('offers_chat');
  const [items, setItems] = useState<Message[]>([]);
  const [listing, setListing] = useState<ListingCard | null>(null);
  const [rating, setRating] = useState<{ averageStars: number; count: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [calling, setCalling] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (!id) return;
    const page = await listMessages(id);
    setItems(page.items); setLoading(false);
  }, [id]);

  // One-time context load: conversation → listing (contextId) → peer rating. Peer = explicit param or the
  // listing's seller. All degrade to null.
  useEffect(() => {
    if (!enabled || !id) return;
    let live = true;
    (async () => {
      const convo = await getConversation(id);
      const l = convo?.contextId ? await getPublicListing(convo.contextId) : null;
      if (!live) return;
      setListing(l);
      const peer = peerId || l?.sellerUserId;
      if (peer) { const s = await sellerSummary(peer); if (live) setRating(s); }
    })();
    return () => { live = false; };
  }, [enabled, id, peerId]);

  useEffect(() => {
    if (!enabled || !id) return;
    refresh(); markConversationRead(id).catch(() => { /* best-effort */ });
    timer.current = setInterval(refresh, POLL_MS);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [enabled, id, refresh]);

  if (!enabled) return <ScreenScaffold title={t('chat.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const peer = peerId || listing?.sellerUserId;
  const send = async () => {
    if (!id || !canSend(text, false)) return;
    const body = normalizeBody(text);
    setText(''); setBusy(true);
    try { await postText(id, body); await refresh(); }
    catch { setText(body); Alert.alert(t('chat.sendFailed')); }
    finally { setBusy(false); }
  };
  const attach = async (pick: () => Promise<PickedImage | null>) => {
    if (!id) return;
    const picked = await pick();
    if (!picked) return;
    setBusy(true);
    try {
      const res = await uploadPickedImage(picked);
      if (res.mediaId) { await postAttachment(id, res.mediaId); await refresh(); }
      else Alert.alert(t('chat.sendFailed'));
    } catch { Alert.alert(t('chat.sendFailed')); }
    finally { setBusy(false); }
  };
  const pickImage = () => Alert.alert(t('createListing.photoSource'), undefined, [
    { text: t('createListing.camera'), onPress: () => attach(captureFromCamera) },
    { text: t('createListing.gallery'), onPress: () => attach(pickFromGallery) },
    { text: t('common.cancel'), style: 'cancel' },
  ]);
  const call = async () => {
    if (!peer) return;
    setCalling(true);
    try { await startMaskedCall(peer, id); Alert.alert(t('chat.calling.title'), t('chat.calling.message')); }
    catch (e) { Alert.alert(e instanceof SdkError && e.isForbidden ? t('orders.action.forbidden') : t('chat.callFailed')); }
    finally { setCalling(false); }
  };

  const views = items.map((m) => presentMessage(m, myId));

  const footer = (
    <View style={styles.inputBar}>
      <Pressable onPress={pickImage} hitSlop={8} disabled={busy} style={styles.attach} accessibilityRole="button" accessibilityLabel={t('chat.attach')}><Text style={styles.attachGlyph}>📎</Text></Pressable>
      <View style={{ flex: 1 }}><Input label="" value={text} onChangeText={setText} placeholder={t('chat.placeholder')} multiline /></View>
      <Button title={t('chat.send')} onPress={send} loading={busy} disabled={!canSend(text, false)} fullWidth={false} />
    </View>
  );

  return (
    <ScreenScaffold title={t('chat.title')} scroll={false} footer={footer}>
      {/* Peer header */}
      <View style={styles.header}>
        <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no"><Text style={styles.avatarGlyph}>👤</Text></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name} numberOfLines={1}>
            {t('chat.sellerGeneric')}
            {rating && rating.count > 0 ? <Text style={styles.rating}>  ⭐ {rating.averageStars.toFixed(1)}</Text> : null}
          </Text>
          {rating ? <Text style={styles.sub}>{t('chat.ratingCount', { n: rating.count })}</Text> : null}
        </View>
        {peer ? (
          <Pressable onPress={call} disabled={calling} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('chat.call')} style={styles.callBtn}>
            <Text style={styles.callGlyph}>📞</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Pinned listing context */}
      {listing ? (
        <View style={styles.listing}>
          <View style={styles.listThumb} accessibilityElementsHidden importantForAccessibility="no"><Text style={styles.listGlyph}>📦</Text></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.listTitle} numberOfLines={1}>{listing.title}</Text>
            <View style={styles.listMeta}>
              <Text style={styles.listQty}>{t('chat.listMeta', { n: listing.quantityAvailable, unit: t(`units.${listing.unitCode}`) })} · </Text>
              <MoneyText minor={listing.priceMinor} currencyCode={listing.currencyCode} langCode={lang} size="xs" />
              <Text style={styles.listQty}> /{t(`units.${listing.unitCode}`)}</Text>
            </View>
          </View>
        </View>
      ) : null}

      {loading ? <View style={{ gap: space[2] }}><SkeletonCard lines={2} /><SkeletonCard lines={2} /></View> : (
        <FlatList
          data={views}
          inverted
          keyExtractor={(v) => v.id}
          contentContainerStyle={{ paddingHorizontal: space[4], paddingVertical: space[2] }}
          ListEmptyComponent={<EmptyState title={t('chat.thread.empty')} />}
          renderItem={({ item, index }) => (
            <View>
              <MessageBubble view={item} imageLabel={t('chat.photo')} voiceLabel={t('chat.voice')} flaggedLabel={t('chat.flagged')} time={safeTime(item.createdAt, lang)} />
              {/* Day divider renders ABOVE the oldest message of each day (inverted list) */}
              {isDayBoundary(views, index) ? <Text style={styles.day}>{safeDay(item.createdAt, lang)}</Text> : null}
            </View>
          )}
        />
      )}
    </ScreenScaffold>
  );
}

function safeTime(iso: string | undefined, lang: string): string {
  if (!iso) return '';
  try { return formatDate(iso, lang, { hour: 'numeric', minute: '2-digit' }); } catch { return ''; }
}
function safeDay(iso: string | undefined, lang: string): string {
  if (!iso) return '';
  try { return formatDate(iso, lang, { day: 'numeric', month: 'short' }); } catch { return ''; }
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingBottom: space[3], borderBottomWidth: 1, borderBottomColor: color.ink100 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: color.primary600, alignItems: 'center', justifyContent: 'center' },
  avatarGlyph: { fontSize: 20 },
  name: { fontFamily: font.body, fontSize: font.size.sm, fontWeight: font.weight.bold, color: color.ink800 },
  rating: { fontFamily: font.body, fontSize: font.size.xs, fontWeight: font.weight.semibold, color: color.accent700 },
  sub: { fontFamily: font.body, fontSize: font.size.xs, color: color.ink500, marginTop: 2 },
  callBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: color.primary50, alignItems: 'center', justifyContent: 'center' },
  callGlyph: { fontSize: 18 },
  listing: { flexDirection: 'row', alignItems: 'center', gap: space[2], marginTop: space[3], padding: space[3], backgroundColor: color.accent50, borderRadius: radius.md },
  listThumb: { width: 32, height: 32, borderRadius: 6, backgroundColor: color.card, alignItems: 'center', justifyContent: 'center' },
  listGlyph: { fontSize: 18 },
  listTitle: { fontFamily: font.body, fontSize: font.size.xs, fontWeight: font.weight.bold, color: color.ink800 },
  listMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  listQty: { fontFamily: font.body, fontSize: font.size.xs, color: color.ink500 },
  day: { alignSelf: 'center', fontFamily: font.body, fontSize: font.size.xs, fontWeight: font.weight.semibold, color: color.ink500, backgroundColor: color.ink100, paddingVertical: 4, paddingHorizontal: space[3], borderRadius: radius.pill, marginVertical: space[2], overflow: 'hidden' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: space[2] },
  attach: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  attachGlyph: { fontSize: 22 },
});
