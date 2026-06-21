// apps/mobile/src/app/(ambassador)/lesson/[id].tsx · screen 165 (video-player / lesson). Thin screen (guide §3):
// shows a lesson and — for a video — fetches a presigned media URL and opens it (the SERVER gates the URL to a
// clean asset). The learner marks the lesson watched/complete (REAL markProgress; the server recomputes the
// enrollment %). If the lesson has a quiz, routes to the quiz. Params carry enrollmentId + courseId (server
// re-checks ownership — no IDOR). Behind `ambassador_training`. Degrade-never-die.
//
// FLAGGED (NOT faked): there's no in-app video dep yet, so playback opens the presigned URL via the OS player
// (Linking) rather than embedding a fabricated player; the progress/complete write is real.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { CourseLesson } from '@krishi-verse/sdk-js';
import { Button, Card, EmptyState, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { getLessons, lessonMediaUrl, markProgress } from '../../../features/education/education.api';
import { parseQuiz } from '../../../features/education/learn';

export default function LessonPlayer() {
  const { id, courseId, enrollmentId } = useLocalSearchParams<{ id: string; courseId: string; enrollmentId: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('ambassador_training');
  const [lesson, setLesson] = useState<CourseLesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id || !courseId) return;
    setLoading(true);
    const ls = await getLessons(courseId);
    setLesson(ls.find((l) => l.id === id) ?? null);
    setLoading(false);
  }, [id, courseId]);
  useEffect(() => { if (enabled) load(); }, [enabled, load]);

  if (!enabled) return <ScreenScaffold title={t('amb.lesson.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const play = async () => {
    if (!lesson?.mediaId) return;
    setBusy(true);
    try {
      const url = await lessonMediaUrl(lesson.mediaId);
      if (!url) { Alert.alert(t('amb.lesson.title'), t('amb.lesson.videoUnavailable')); return; }
      const ok = await Linking.canOpenURL(url);
      if (ok) await Linking.openURL(url); else Alert.alert(t('amb.lesson.title'), t('amb.lesson.videoUnavailable'));
    } finally { setBusy(false); }
  };

  const markDone = async () => {
    if (!enrollmentId || !id) return;
    setBusy(true);
    try {
      await markProgress(enrollmentId, id, { secondsWatched: lesson?.durationSecs ?? 0, completed: true });
      router.back();
    } catch { Alert.alert(t('amb.lesson.title'), t('amb.lesson.markFailed')); }
    finally { setBusy(false); }
  };

  const hasQuiz = !!lesson && parseQuiz(lesson.quiz) !== null;

  return (
    <ScreenScaffold title={lesson?.defaultTitle ?? t('amb.lesson.title')}>
      {loading ? <SkeletonCard lines={5} /> : !lesson ? (
        <EmptyState title={t('amb.lesson.unavailable')} actionLabel={t('common.retry')} onAction={load} />
      ) : (
        <>
          <Card>
            <Text style={styles.kind}>{t(`amb.contentKind.${lesson.contentKind}`)}</Text>
            {lesson.body ? <Text style={styles.body}>{lesson.body}</Text> : null}
            {lesson.mediaId ? <View style={{ marginTop: space[3] }}><Button title={t('amb.lesson.play')} variant="outline" loading={busy} onPress={play} /></View> : null}
          </Card>
          <View style={{ marginTop: space[4], gap: space[3] }}>
            {hasQuiz ? (
              <Button title={t('amb.lesson.takeQuiz')} onPress={() => router.push({ pathname: '/(ambassador)/quiz/[id]', params: { id: lesson.id, courseId: courseId!, enrollmentId: enrollmentId! } })} />
            ) : (
              <Button title={t('amb.lesson.markDone')} loading={busy} disabled={busy} onPress={markDone} />
            )}
          </View>
        </>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  kind: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500, marginBottom: space[2] },
  body: { fontFamily: font.body, fontSize: font.size.md, color: color.ink700 },
});
