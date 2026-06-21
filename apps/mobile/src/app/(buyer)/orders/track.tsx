// apps/mobile/src/app/(buyer)/orders/track.tsx · screen 131 (order tracking, buyer). Thin screen (guide §3):
// reuse the SHARED features/orders.getOrderShipment + the PURE trackingSteps → a progress Timeline. Behind
// `buyer_app`. Degrade-never-die: no shipment / failure → friendly state.
import React, { useCallback, useEffect, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { Shipment } from '@krishi-verse/sdk-js';
import { Card, EmptyState, StatusPill, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { getOrderShipment } from '../../../features/orders/orders.api';
import { trackingSteps, orderStatusTone } from '../../../features/orders/order-status';
import { Timeline } from '../../../features/orders/components/Timeline';

export default function BuyerTrack() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { t } = useTranslation();
  const enabled = useFlag('buyer_app');
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => { if (!orderId) return; setLoading(true); setShipment(await getOrderShipment(orderId)); setLoading(false); }, [orderId]);
  useEffect(() => { if (enabled) load(); }, [enabled, load]);

  if (!enabled) return <ScreenScaffold title={t('track.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  return (
    <ScreenScaffold title={t('track.title')}>
      {loading ? <SkeletonCard lines={6} /> : !shipment ? (
        <EmptyState title={t('track.noShipment.title')} message={t('track.noShipment.message')} actionLabel={t('common.retry')} onAction={load} />
      ) : (
        <Card>
          {shipment.awbNo ? <Text style={styles.awb}>{t('track.awb', { awb: shipment.awbNo })}</Text> : null}
          <StatusPill label={t(`shipment.status.${shipment.status}`)} tone={orderStatusTone(shipment.status)} />
          <Text style={styles.spacer} />
          <Timeline steps={trackingSteps(shipment.status)} labelFor={(k) => t(`shipment.status.${k}`)} />
        </Card>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  awb: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500, marginBottom: space[2] },
  spacer: { height: space[4] },
});
