// apps/mobile/src/app/(ambassador)/quiz/[id].tsx · screen 166 (quiz). Thin screen (guide §3): renders the lesson's
// quiz (parsed defensively from the opaque payload), scores it with the PURE `scoreQuiz`, and on submit posts the
// score + completion via REAL markProgress (the SERVER stores the score + recomputes the enrollment). Params carry
// enrollmentId (server re-checks ownership — no IDOR). Behind `ambassador_training`. Degrade-never-die.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { CourseLesson } from '@krishi-verse/sdk-js';
import { Button, Card, EmptyState, StatusPill, ScreenScaffold, SkeletonCard, color, font, space, radius } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { getLessons, markProgress } from '../../../features/education/education.api';
import { parseQuiz, scoreQuiz, type QuizQuestion, type QuizResult } from '../../../features/education/learn';

export default function Quiz() {
  const { id, courseId, enrollmentId } = useLocalSearchParams<{ id: string; courseId?: string; enrollmentId: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('ambassador_training');
  const [lesson, setLesson] = useState<CourseLesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [busy, setBusy] = useState(false);

  // The lesson belongs to a course; if courseId wasn't passed we can still fetch via the lesson's own course on
  // the detail — but the player always passes courseId in practice. Fall back to empty (degrade).
  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const cid = courseId ?? '';
    const ls = cid ? await getLessons(cid) : [];
    setLesson(ls.find((l) => l.id === id) ?? null);
    setLoading(false);
  }, [id, courseId]);
  useEffect(() => { if (enabled) load(); }, [enabled, load]);

  const questions: QuizQuestion[] | null = useMemo(() => (lesson ? parseQuiz(lesson.quiz) : null), [lesson]);

  if (!enabled) return <ScreenScaffold title={t('amb.quiz.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const submit = async () => {
    if (!questions || !enrollmentId || !id) return;
    const r = scoreQuiz(questions, questions.map((_, i) => answers[i] ?? null));
    setResult(r);
    setBusy(true);
    try { await markProgress(enrollmentId, id, { quizScore: r.scorePct, completed: r.passed }); }
    catch { Alert.alert(t('amb.quiz.title'), t('amb.quiz.submitFailed')); }
    finally { setBusy(false); }
  };

  const allAnswered = questions ? questions.every((_, i) => answers[i] != null) : false;

  return (
    <ScreenScaffold
      title={t('amb.quiz.title')}
      footer={questions && !result ? <Button title={t('amb.quiz.submit')} onPress={submit} loading={busy} disabled={!allAnswered || busy} /> : (result ? <Button title={t('amb.quiz.done')} onPress={() => router.back()} /> : undefined)}
    >
      {loading ? <SkeletonCard lines={6} /> : !questions ? (
        <EmptyState title={t('amb.quiz.unavailable.title')} message={t('amb.quiz.unavailable.message')} />
      ) : result ? (
        <Card style={{ alignItems: 'center' }}>
          <StatusPill label={t(result.passed ? 'amb.quiz.passed' : 'amb.quiz.failed')} tone={result.passed ? 'success' : 'danger'} />
          <Text style={styles.score}>{t('amb.quiz.score', { score: String(result.scorePct), correct: String(result.correct), total: String(result.total) })}</Text>
          {!result.passed ? <Text style={styles.retry}>{t('amb.quiz.retryNote')}</Text> : null}
        </Card>
      ) : (
        questions.map((q, qi) => (
          <Card key={qi} style={styles.qCard}>
            <Text style={styles.q}>{qi + 1}. {q.q}</Text>
            {q.options.map((opt, oi) => {
              const sel = answers[qi] === oi;
              return (
                <Pressable key={oi} onPress={() => setAnswers((a) => ({ ...a, [qi]: oi }))} style={[styles.opt, sel && styles.optOn]} accessibilityRole="radio" accessibilityState={{ selected: sel }}>
                  <Text style={[styles.optText, sel && styles.optTextOn]}>{opt}</Text>
                </Pressable>
              );
            })}
          </Card>
        ))
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  qCard: { marginBottom: space[3] },
  q: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800, marginBottom: space[2] },
  opt: { padding: space[3], borderRadius: radius.lg, borderWidth: 1.5, borderColor: color.ink200, backgroundColor: color.card, marginBottom: space[2], minHeight: 48, justifyContent: 'center' },
  optOn: { borderColor: color.primary600, backgroundColor: color.primary50 },
  optText: { fontFamily: font.body, fontSize: font.size.md, color: color.ink800 },
  optTextOn: { color: color.primary800, fontWeight: font.weight.semibold },
  score: { fontFamily: font.display, fontSize: font.size.xl, fontWeight: font.weight.bold, color: color.ink800, marginTop: space[3] },
  retry: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500, marginTop: space[2], textAlign: 'center' },
});
