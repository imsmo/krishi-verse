// apps/mobile/src/app/(farmer)/notifications/[id].tsx · screen 172 (notification detail). Marks the item read on
// open (idempotent) and shows its rendered title/body. Degrade-never-die: if the item isn't found (e.g. cache
// cleared) it shows a neutral "opened" state. Behind the `notifications` flag.
import React, { useCallback, useEffect, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Card, EmptyState, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { getById, markRead } from '../../../features/notifications/notifications.api';
import { presentNotification, type PresentedNotification } from '../../../features/notifications/present';

export default function NotificationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const enabled = useFlag('notifications');
  const [item, setItem] = useState<PresentedNotification | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const n = await getById(id);
    setItem(n ? presentNotification(n) : null);
    setLoading(false);
    void markRead(id); // idempotent; refreshes the inbox cache so the dot clears
  }, [id]);
  useEffect(() => { if (enabled) load(); }, [enabled, load]);

  if (!enabled) return <ScreenScaffold title={t('notifications.title')}><EmptyState title={t('notifications.unavailable')} /></ScreenScaffold>;

  return (
    <ScreenScaffold title={item?.title ?? t('notifications.opened')}>
      {loading ? <SkeletonCard lines={3} /> : !item ? (
        <EmptyState title={t('notifications.opened')} />
      ) : (
        <Card>
          <Text style={styles.title}>{item.title}</Text>
          {item.body ? <Text style={styles.body}>{item.body}</Text> : null}
        </Card>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: font.display, fontSize: font.size.xl, fontWeight: font.weight.bold, color: color.ink800 },
  body: { fontFamily: font.body, fontSize: font.size.md, color: color.ink600, marginTop: space[3], lineHeight: 22 },
});
