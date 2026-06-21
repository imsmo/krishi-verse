// apps/mobile/src/app/(farmer)/assistant.tsx · screen 125 (AI assistant chat). Thin screen (guide §3): the farmer
// asks a question (typed or by voice) and the SERVER answers in their language (hi/en/gu). The app NEVER fabricates
// an answer — if the assistant endpoint isn't live/reachable, askAssistant returns unavailable and we show an
// honest system message. Send is idempotent (Law 3, in the data layer). Behind `tips_assistant`. Degrade-never-die.
// FLAGGED: no farmer-facing AI endpoint exists yet — this wires the real, assumed contract; answers appear once it lands.
import React, { useCallback, useRef, useState } from 'react';
import { View, Text, FlatList, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Button, Card, Input, EmptyState, ScreenScaffold, VoiceButton, color, font, space, radius } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { useVoiceDictation } from '../../core/voice';
import { askAssistant } from '../../features/content/content.api';
import { buildAssistantDraft, appendTurn, type ChatTurn } from '../../features/content/content';
import { newId } from '../../core/util/ids';

export default function Assistant() {
  const { t, lang } = useTranslation();
  const enabled = useFlag('tips_assistant');
  const voice = useVoiceDictation(lang);
  const [text, setText] = useState('');
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);

  const send = useCallback(async (raw: string) => {
    if (sending.current) return;
    const draft = buildAssistantDraft({ text: raw, lang, sessionId });
    if (!draft.ok || !draft.input) return;
    sending.current = true; setBusy(true);
    const userTurn: ChatTurn = { id: newId(), role: 'user', text: draft.input.message, at: Date.now() };
    setTurns((prev) => appendTurn(prev, userTurn));
    setText(''); voice.reset();
    const res = await askAssistant(draft.input);
    const replyText = res.ok && res.reply ? res.reply.reply : t('content.assistant.unavailable');
    if (res.ok && res.reply?.sessionId) setSessionId(res.reply.sessionId);
    setTurns((prev) => appendTurn(prev, { id: newId(), role: 'assistant', text: replyText, at: Date.now() }));
    sending.current = false; setBusy(false);
  }, [lang, sessionId, voice, t]);

  if (!enabled) return <ScreenScaffold title={t('content.assistant.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const composed = (voice.transcript || text).trim();

  return (
    <ScreenScaffold title={t('content.assistant.title')}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {turns.length === 0 ? (
          <EmptyState title={t('content.assistant.empty.title')} message={t('content.assistant.empty.message')} />
        ) : (
          <FlatList
            style={styles.fill}
            data={turns}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => (
              <View style={[styles.bubbleRow, item.role === 'user' ? styles.right : styles.left]}>
                <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.aiBubble]}>
                  <Text style={item.role === 'user' ? styles.userText : styles.aiText}>{item.text}</Text>
                </View>
              </View>
            )}
            contentContainerStyle={{ paddingVertical: space[3] }}
          />
        )}

        <Card style={styles.composer}>
          <Input
            label={t('content.assistant.inputLabel')}
            value={voice.listening ? voice.transcript : text}
            onChangeText={setText}
            placeholder={t('content.assistant.placeholder')}
            multiline
          />
          <View style={styles.composerRow}>
            <VoiceButton label={t('content.voiceSearch.mic')} listening={voice.listening} onPress={() => (voice.listening ? voice.stop() : voice.start())} />
            <View style={styles.sendBtn}><Button title={t('content.assistant.send')} loading={busy} disabled={!composed} onPress={() => send(composed)} /></View>
          </View>
          {voice.error ? <Text style={styles.err}>{t('content.voiceSearch.error')}</Text> : null}
        </Card>
      </KeyboardAvoidingView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bubbleRow: { flexDirection: 'row', marginBottom: space[2] },
  left: { justifyContent: 'flex-start' },
  right: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '82%', paddingVertical: space[2], paddingHorizontal: space[3], borderRadius: radius.lg },
  userBubble: { backgroundColor: color.primary600 },
  aiBubble: { backgroundColor: color.card, borderWidth: 1, borderColor: color.ink100 },
  userText: { fontFamily: font.body, fontSize: font.size.md, color: color.card },
  aiText: { fontFamily: font.body, fontSize: font.size.md, color: color.ink800 },
  composer: { marginTop: space[2] },
  composerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space[2], gap: space[3] },
  sendBtn: { flex: 1 },
  err: { fontFamily: font.body, fontSize: font.size.sm, color: color.danger, marginTop: space[2] },
});
