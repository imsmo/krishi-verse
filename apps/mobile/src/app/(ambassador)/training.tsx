// apps/mobile/src/app/(ambassador)/training.tsx · screen 94 (training catalogue). Thin screen (guide §3): the
// published course catalogue (education `box=browse`) with the caller's enrolled courses marked. Tapping a course
// opens its detail. Behind `ambassador_training`. Keyset; degrade-never-die. Money via MoneyText (free = ₹0).
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import type { Course, Enrollment } from '@krishi-verse/sdk-js';
import { Card, EmptyState, MoneyText, StatusPill, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { browseCourses, myEnrollments } from '../../features/education/education.api';

export default function Training() {
  const { t, lang } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('ambassador_training');
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrolled, setEnrolled] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [c, e] = await Promise.all([browseCourses(), myEnrollments()]);
    setCourses(c.items); setEnrolled(new Set(e.items.map((x: Enrollment) => x.courseId))); setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { if (enabled) { setLoading(true); load(); } }, [enabled, load]));

  if (!enabled) return <ScreenScaffold title={t('amb.training.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  return (
    <ScreenScaffold title={t('amb.training.title')}>
      {loading ? <SkeletonCard lines={5} /> : courses.length === 0 ? (
        <EmptyState title={t('amb.training.empty.title')} message={t('amb.training.empty.message')} actionLabel={t('common.retry')} onAction={load} />
      ) : (
        <FlatList
          data={courses}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push({ pathname: '/(ambassador)/course/[id]', params: { id: item.id } })} accessibilityRole="button">
              <Card style={styles.card}>
                <View style={styles.row}>
                  <Text style={styles.title} numberOfLines={2}>{item.defaultTitle}</Text>
                  {enrolled.has(item.id) ? <StatusPill label={t('amb.training.enrolled')} tone="success" /> : null}
                </View>
                <View style={[styles.row, { marginTop: space[1] }]}>
                  <Text style={styles.meta}>{t(`amb.level.${item.level}`)}</Text>
                  {item.priceMinor === '0' ? <Text style={styles.free}>{t('amb.training.free')}</Text> : <MoneyText minor={item.priceMinor} currencyCode={item.currencyCode} langCode={lang} size="md" />}
                </View>
              </Card>
            </Pressable>
          )}
          contentContainerStyle={{ paddingBottom: space[6] }}
        />
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] },
  title: { flex: 1, fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800 },
  meta: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500 },
  free: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.successDark },
});
