// apps/mobile/src/app/(farmer)/voice-search.tsx · screen 184 (voice search). Thin screen (guide §3): the farmer
// speaks (on-device STT, their language) → the transcript filters the cached tips locally (PURE searchResources,
// ReDoS-safe) so it works offline. Also typeable. Tap a result for the tip. Behind `tips_assistant`.
// NOTE: tips have no server text-search endpoint → we search the cached approved tips on-device (flagged).
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import type { LearningResource } from '@krishi-verse/sdk-js';
import { Button, Card, Input, EmptyState, ScreenScaffold, VoiceButton, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { useVoiceDictation } from '../../core/voice';
import { listTips } from '../../features/content/content.api';
import { searchResources, normalizeQuery } from '../../features/content/content';

export default function VoiceSearch() {
  const { t, lang } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('tips_assistant');
  const voice = useVoiceDictation(lang);
  const [all, setAll] = useState<LearningResource[]>([]);
  const [typed, setTyped] = useState('');
  const [searched, setSearched] = useState(false);

  useEffect(() => { if (enabled) listTips().then((r) => setAll(r.items)).catch(() => setAll([])); }, [enabled]);

  const query = voice.transcript || typed;
  const results = searched ? searchResources(all, query) : [];

  const run = useCallback(() => { setSearched(!!normalizeQuery(query)); }, [query]);

  if (!enabled) return <ScreenScaffold title={t('content.voiceSearch.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  return (
    <ScreenScaffold title={t('content.voiceSearch.title')}>
      <Card>
        <VoiceButton label={t('content.voiceSearch.mic')} hint={t('content.voiceSearch.hint')} listening={voice.listening} onPress={() => (voice.listening ? voice.stop() : voice.start())} />
        <Input label={t('content.search.label')} value={voice.listening ? voice.transcript : typed} onChangeText={setTyped} placeholder={t('content.voiceSearch.placeholder')} returnKeyType="search" onSubmitEditing={run} />
        <View style={{ marginTop: space[2] }}><Button title={t('content.voiceSearch.search')} disabled={!normalizeQuery(query)} onPress={run} /></View>
        {voice.error ? <Text style={styles.err}>{t('content.voiceSearch.error')}</Text> : null}
      </Card>

      {searched ? (
        results.length === 0 ? (
          <View style={{ marginTop: space[3] }}><EmptyState title={t('content.voiceSearch.noResults.title')} message={t('content.voiceSearch.noResults.message', { q: normalizeQuery(query) })} /></View>
        ) : (
          <FlatList
            style={{ marginTop: space[3] }}
            data={results}
            keyExtractor={(r) => r.id}
            renderItem={({ item }) => (
              <Pressable onPress={() => router.push({ pathname: '/(farmer)/tips/[id]', params: { id: item.id } })} accessibilityRole="button">
                <Card style={styles.card}><Text style={styles.title} numberOfLines={2}>{item.title}</Text></Card>
              </Pressable>
            )}
            contentContainerStyle={{ paddingBottom: space[6] }}
          />
        )
      ) : null}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: space[2] },
  title: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800 },
  err: { fontFamily: font.body, fontSize: font.size.sm, color: color.danger, marginTop: space[2] },
});
