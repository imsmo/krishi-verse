// apps/mobile/src/app/(farmer)/notifications/index.tsx · screens 28/191 (notification inbox). Thin screen: lists
// the caller's notifications (features/notifications, SWR-cached), All/Unread filter (191), tap → detail. An
// unread dot marks new items. Behind the `notifications` flag. Degrade-never-die: empty/failed → friendly state.
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import type { NotificationItem } from '@krishi-verse/sdk-js';
import { Card, EmptyState, ScreenScaffold, SkeletonCard, color, font, space, radius } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { inbox } from '../../../features/notifications/notifications.api';
import { presentNotification } from '../../../features/notifications/present';

export default function NotificationInbox() {
  const router = useRouter();
  const { t } = useTranslation();
  const enabled = useFlag('notifications');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => { setItems((await inbox({ unreadOnly })).items); setLoading(false); }, [unreadOnly]);
  useFocusEffect(useCallback(() => { if (enabled) { setLoading(true); load(); } }, [enabled, load]));
  const onRefresh = useCallback(async () => { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } }, [load]);

  if (!enabled) return <ScreenScaffold title={t('notifications.title')}><EmptyState title={t('notifications.unavailable')} /></ScreenScaffold>;

  return (
    <ScreenScaffold title={t('notifications.title')} scroll={false}>
      <View style={styles.filters}>
        {[['all', false], ['unread', true]].map(([key, val]) => {
          const active = unreadOnly === val;
          return (
            <Pressable key={String(key)} onPress={() => setUnreadOnly(val as boolean)} style={[styles.chip, active && styles.chipOn]} accessibilityRole="tab" accessibilityState={{ selected: active }}>
              <Text style={[styles.chipText, active && styles.chipTextOn]}>{t(`notifications.${key}`)}</Text>
            </Pressable>
          );
        })}
      </View>
      {loading ? <View style={{ gap: space[3], marginTop: space[3] }}><SkeletonCard lines={2} /><SkeletonCard lines={2} /></View> : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          style={{ marginTop: space[3] }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.primary600} />}
          ItemSeparatorComponent={() => <View style={{ height: space[2] }} />}
          ListEmptyComponent={<EmptyState title={t('notifications.empty.title')} message={t('notifications.empty.message')} />}
          renderItem={({ item }) => {
            const p = presentNotification(item);
            return (
              <Card onPress={() => router.push(`/(farmer)/notifications/${item.id}`)} accessibilityLabel={p.title}>
                <View style={styles.row}>
                  {p.unread ? <View style={styles.dot} /> : <View style={styles.dotSpacer} />}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.title, p.unread && styles.titleUnread]} numberOfLines={1}>{p.title}</Text>
                    {p.body ? <Text style={styles.body} numberOfLines={2}>{p.body}</Text> : null}
                  </View>
                </View>
              </Card>
            );
          }}
        />
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', gap: space[2] },
  chip: { paddingHorizontal: space[4], paddingVertical: space[2], borderRadius: radius.pill, borderWidth: 1.5, borderColor: color.ink200, backgroundColor: color.card },
  chipOn: { borderColor: color.primary600, backgroundColor: color.primary50 },
  chipText: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink600 },
  chipTextOn: { color: color.primary800, fontWeight: font.weight.semibold },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3] },
  dot: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: color.primary600, marginTop: 6 },
  dotSpacer: { width: 10 },
  title: { fontFamily: font.body, fontSize: font.size.md, color: color.ink700 },
  titleUnread: { fontWeight: font.weight.bold, color: color.ink900 },
  body: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500, marginTop: 2 },
});
