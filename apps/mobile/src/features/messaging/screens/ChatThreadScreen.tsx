// apps/mobile/src/features/messaging/screens/ChatThreadScreen.tsx · shared chat-thread UI (screen 98 "Chat with
// Seller" + screen 520 "Human Support Chat" + any other by-conversation-id thread — one template, several call
// sites). Originally lived only under (buyer)/chat/[id].tsx, gated by the WHOLE (buyer) tab group's `buyer_app`
// kill-switch (default OFF) — which meant a farmer tapping a listing inquiry, or ANY role opening the unified
// messages inbox (191) or a support ticket's thread (520), hit "Unavailable" even though messaging itself
// (`offers_chat`) was on. This component is now mounted from BOTH (buyer)/chat/[id].tsx (unchanged behaviour) and
// the cross-role (system)/chat/[id].tsx (not gated by any per-role tab flag) so every caller reaches a working
// thread. Behind `offers_chat`; membership server-enforced (non-participant → 404). Degrade-never-die.
// §13 gaps (no contract → rendered honestly, never faked): see the original header notes below.
//  • Peer NAME + avatar initials: no participant-name on the bare GET conversation/:id contract — callers that
//    already know a real name (e.g. the inbox's enriched summary) pass `peerDisplayName`; otherwise a generic
//    role-appropriate label is shown (never a fabricated "Ramesh Patel"). The ⭐ rating IS real (reviews summary
//    for the peer) and is only fetched/shown for the buyer↔seller listing-chat case (`showListingContext`).
//  • "● Online" presence + "…is typing": no presence/typing contract → omitted (never a fake status).
//  • Read ticks "✓✓": the Message contract has no delivery/read state → no read receipts are shown.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import type { Message, ListingCard } from '@krishi-verse/sdk-js';
import { SdkError } from '@krishi-verse/sdk-js';
import { Input, Button, EmptyState, MoneyText, ScreenScaffold, SkeletonCard, color, font, space, radius } from '@krishi-verse/ui-native';
import { formatDate } from '@krishi-verse/i18n';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { useAuth } from '../../../core/auth/auth.store';
import { listMessages, getConversation, postText, postAttachment, startMaskedCall, markConversationRead } from '../messaging.api';
import { getPublicListing, sellerSummary } from '../../buyer/browse.api';
import { presentMessage, canSend, normalizeBody, isDayBoundary } from '../message-view';
import { MessageBubble } from '../components/MessageBubble';
import { pickFromGallery, captureFromCamera, uploadPickedImage, type PickedImage } from '../../../core/media';

const POLL_MS = 5000;

export interface ChatThreadScreenProps {
  conversationId: string;
  /** The other participant's user id, when the caller already knows it (e.g. an inquiry row's buyerUserId, or a
   *  ?peerId param) — enables the masked-call button without a round-trip. Falls back to the listing's seller
   *  when `showListingContext` is on and this is omitted. */
  peerUserId?: string;
  /** A real display name for the header, when the caller already has one (e.g. the inbox summary's enriched
   *  `counterpartyName`). Never fabricated — omit rather than guess. */
  peerDisplayName?: string;
  /** i18n key for the generic peer label shown when `peerDisplayName` is absent. Defaults to 'chat.sellerGeneric'
   *  (buyer↔seller chat, unchanged from the original screen). */
  peerFallbackKey?: string;
  /** Screen title. Defaults to 'chat.title' ("Chats" — unchanged from the original screen). */
  screenTitle?: string;
  /** Whether to fetch + pin the listing-context card + peer rating (buyer↔seller listing chats only). Default
   *  true so the existing buyer chat screen's behaviour is unchanged; support/other threads pass false. */
  showListingContext?: boolean;
}

export function ChatThreadScreen({ conversationId: id, peerUserId, peerDisplayName, peerFallbackKey, screenTitle, showListingContext = true }: ChatThreadScreenProps) {
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

  // One-time context load: conversation → (listing-chats only) listing (contextId) → peer rating. Peer = explicit
  // prop or the listing's seller. All degrade to null — a support/other thread simply never fetches these.
  useEffect(() => {
    if (!enabled || !id) return;
    let live = true;
    (async () => {
      if (!showListingContext) return;
      const convo = await getConversation(id);
      const l = convo?.contextId ? await getPublicListing(convo.contextId) : null;
      if (!live) return;
      setListing(l);
      const peer = peerUserId || l?.sellerUserId;
      if (peer) { const s = await sellerSummary(peer); if (live) setRating(s); }
    })();
    return () => { live = false; };
  }, [enabled, id, peerUserId, showListingContext]);

  useEffect(() => {
    if (!enabled || !id) return;
    refresh(); markConversationRead(id).catch(() => { /* best-effort */ });
    timer.current = setInterval(refresh, POLL_MS);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [enabled, id, refresh]);

  const title = screenTitle ?? t('chat.title');
  if (!enabled) return <ScreenScaffold title={title}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const peer = peerUserId || (showListingContext ? listing?.sellerUserId : undefined);
  const displayName = peerDisplayName || t(peerFallbackKey ?? 'chat.sellerGeneric');
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
    <ScreenScaffold title={title} scroll={false} footer={footer}>
      {/* Peer header */}
      <View style={styles.header}>
        <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no"><Text style={styles.avatarGlyph}>👤</Text></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
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

      {/* Pinned listing context (buyer↔seller listing chats only) */}
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
