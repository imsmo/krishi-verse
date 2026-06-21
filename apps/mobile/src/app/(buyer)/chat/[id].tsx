// apps/mobile/src/app/(buyer)/chat/[id].tsx · screen 98 (chat thread). Thin screen (guide §3): list messages
// (keyset, newest-first → inverted list), poll every 5s while focused (realtime-ish), send text or an image
// (core/media compress+upload → attachmentMediaId; bytes never touch the API). A masked-call button (shown when we
// know the peer) bridges the two real numbers SERVER-SIDE — no number is ever shown. Behind `offers_chat`.
// Membership is server-enforced (non-participant → 404). Degrade-never-die.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { Message } from '@krishi-verse/sdk-js';
import { SdkError } from '@krishi-verse/sdk-js';
import { Input, Button, EmptyState, ScreenScaffold, SkeletonCard, color, font, space, radius } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { useAuth } from '../../../core/auth/auth.store';
import { listMessages, postText, postAttachment, startMaskedCall, markConversationRead } from '../../../features/messaging/messaging.api';
import { presentMessage, canSend, normalizeBody } from '../../../features/messaging/message-view';
import { MessageBubble } from '../../../features/messaging/components/MessageBubble';
import { pickFromGallery, captureFromCamera, uploadPickedImage, type PickedImage } from '../../../core/media';

const POLL_MS = 5000;

export default function ChatThread() {
  const { id, peerId } = useLocalSearchParams<{ id: string; peerId?: string }>();
  const { t } = useTranslation();
  const { state } = useAuth();
  const myId = state.profile?.id ?? '';
  const enabled = useFlag('offers_chat');
  const [items, setItems] = useState<Message[]>([]);
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

  useEffect(() => {
    if (!enabled || !id) return;
    refresh(); markConversationRead(id).catch(() => { /* best-effort */ });
    timer.current = setInterval(refresh, POLL_MS);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [enabled, id, refresh]);

  if (!enabled) return <ScreenScaffold title={t('chat.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

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
    if (!peerId) return;
    setCalling(true);
    try { await startMaskedCall(peerId, id); Alert.alert(t('chat.calling.title'), t('chat.calling.message')); }
    catch (e) { Alert.alert(e instanceof SdkError && e.isForbidden ? t('orders.action.forbidden') : t('chat.callFailed')); }
    finally { setCalling(false); }
  };

  const footer = (
    <View style={styles.inputBar}>
      <Pressable onPress={pickImage} hitSlop={8} disabled={busy} style={styles.attach} accessibilityRole="button" accessibilityLabel={t('chat.attach')}><Text style={styles.attachGlyph}>📎</Text></Pressable>
      <View style={{ flex: 1 }}><Input label="" value={text} onChangeText={setText} placeholder={t('chat.placeholder')} multiline /></View>
      <Button title={t('chat.send')} onPress={send} loading={busy} disabled={!canSend(text, false)} fullWidth={false} />
    </View>
  );

  return (
    <ScreenScaffold title={t('chat.title')} scroll={false} footer={footer}>
      {peerId ? (
        <Pressable onPress={call} disabled={calling} style={styles.callRow} accessibilityRole="button" accessibilityLabel={t('chat.call')}>
          <Text style={styles.callText}>📞 {calling ? t('chat.calling.title') : t('chat.call')}</Text>
        </Pressable>
      ) : null}
      {loading ? <View style={{ gap: space[2] }}><SkeletonCard lines={2} /><SkeletonCard lines={2} /></View> : (
        <FlatList
          data={items}
          inverted
          keyExtractor={(m) => m.id}
          ListEmptyComponent={<EmptyState title={t('chat.thread.empty')} />}
          renderItem={({ item }) => (
            <MessageBubble view={presentMessage(item, myId)} imageLabel={t('chat.photo')} voiceLabel={t('chat.voice')} flaggedLabel={t('chat.flagged')} />
          )}
        />
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  callRow: { alignItems: 'center', paddingVertical: space[2], marginBottom: space[2], borderRadius: radius.pill, backgroundColor: color.primary50, borderWidth: 1, borderColor: color.primary200 },
  callText: { fontFamily: font.body, fontSize: font.size.sm, fontWeight: font.weight.semibold, color: color.primary800 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: space[2] },
  attach: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  attachGlyph: { fontSize: 22 },
});
