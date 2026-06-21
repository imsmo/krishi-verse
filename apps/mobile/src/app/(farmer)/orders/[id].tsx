// apps/mobile/src/app/(farmer)/orders/[id].tsx · order detail + lifecycle (screens 57/23). Thin screen (guide §3):
// getOrder → render money breakdown (Law 2 MoneyText), items, status; the action bar is built from the PURE
// nextActions(status, role) map. Transition actions (confirm/packed/ready/complete/cancel) call the api and reload;
// the SERVER is the authority (a 409 "already moved"/403 "not allowed" is shown, never worked around). Navigation
// actions (record delivery / track / review / report) push the sub-screen. Mutating actions are gated behind the
// `orders_fulfilment` flag (kill-switch); viewing always works. Degrade-never-die on every state.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { OrderDetail, OrderRole } from '@krishi-verse/sdk-js';
import { SdkError } from '@krishi-verse/sdk-js';
import { Button, Card, EmptyState, MoneyText, StatusPill, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { getOrder, confirmOrder, packOrder, readyOrder, completeOrder, cancelOrder } from '../../../features/orders/orders.api';
import { nextActions, orderStatusTone, type OrderAction } from '../../../features/orders/order-status';

export default function OrderDetailScreen() {
  const { id, role } = useLocalSearchParams<{ id: string; role?: string }>();
  const { t, lang } = useTranslation();
  const router = useRouter();
  const canAct = useFlag('orders_fulfilment');
  const orderRole: OrderRole = role === 'buyer' ? 'buyer' : 'seller';
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<OrderAction | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true); setFailed(false);
    const o = await getOrder(id); setOrder(o); setFailed(!o); setLoading(false);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const runTransition = async (action: OrderAction, fn: () => Promise<unknown>) => {
    setBusy(action);
    try { await fn(); await load(); }
    catch (e) {
      const msg = e instanceof SdkError && e.isConflict ? t('orders.action.conflict')
        : e instanceof SdkError && e.isForbidden ? t('orders.action.forbidden')
        : t('common.error.generic');
      Alert.alert(t('orders.action.failed'), msg);
    } finally { setBusy(null); }
  };

  const confirmCancel = () => Alert.alert(t('orders.cancel.title'), t('orders.cancel.message'), [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('orders.cancel.confirm'), style: 'destructive', onPress: () => runTransition('cancel', () => cancelOrder(id!)) },
  ]);

  const onAction = (a: OrderAction) => {
    if (!id) return;
    switch (a) {
      case 'confirm': return runTransition('confirm', () => confirmOrder(id));
      case 'packed': return runTransition('packed', () => packOrder(id));
      case 'ready': return runTransition('ready', () => readyOrder(id));
      case 'complete': return runTransition('complete', () => completeOrder(id));
      case 'cancel': return confirmCancel();
      case 'recordDelivery': return router.push({ pathname: '/(farmer)/orders/pod', params: { orderId: id } });
      case 'track': return router.push({ pathname: '/(farmer)/orders/track', params: { orderId: id } });
      case 'review': return router.push({ pathname: '/(farmer)/orders/review', params: { orderId: id } });
      case 'report': return router.push({ pathname: '/(farmer)/orders/report', params: { orderId: id } });
    }
  };

  const actions = order ? nextActions(order.status, orderRole) : [];
  const isTransition = (a: OrderAction) => a === 'confirm' || a === 'packed' || a === 'ready' || a === 'complete' || a === 'cancel';

  return (
    <ScreenScaffold title={order ? t('orders.orderNo', { id: order.orderNo }) : ' '}>
      {loading ? <SkeletonCard lines={6} /> : !order || failed ? (
        <EmptyState title={t('orders.unavailable')} actionLabel={t('common.retry')} onAction={load} />
      ) : (
        <>
          <Card>
            <View style={styles.head}>
              <StatusPill label={t(`orders.status.${order.status}`)} tone={orderStatusTone(order.status)} />
              <MoneyText minor={order.totalMinor} currencyCode={order.currencyCode} langCode={lang} size="xl" />
            </View>
            {order.items.map((it) => (
              <View key={it.listing_id} style={styles.item}>
                <Text style={styles.itemName} numberOfLines={1}>{it.title_snapshot}</Text>
                <Text style={styles.itemQty}>{it.quantity} {it.unit_code}</Text>
                <MoneyText minor={it.line_total_minor} currencyCode={order.currencyCode} langCode={lang} size="md" />
              </View>
            ))}
          </Card>

          <Card style={{ marginTop: space[3] }}>
            <Breakdown label={t('orders.subtotal')} minor={order.subtotalMinor} cc={order.currencyCode} lang={lang} />
            <Breakdown label={t('orders.delivery')} minor={order.deliveryFeeMinor} cc={order.currencyCode} lang={lang} />
            {order.discountMinor !== '0' ? <Breakdown label={t('orders.discount')} minor={order.discountMinor} cc={order.currencyCode} lang={lang} /> : null}
            <Breakdown label={t('orders.tax')} minor={order.taxMinor} cc={order.currencyCode} lang={lang} />
            <Breakdown label={t('orders.total')} minor={order.totalMinor} cc={order.currencyCode} lang={lang} strong />
          </Card>

          {actions.length ? (
            <View style={styles.actions}>
              {actions.map((a) => {
                const transition = isTransition(a);
                if (transition && !canAct) return null; // mutating actions behind the kill-switch
                return (
                  <Button key={a} title={t(`orders.action.${a}`)}
                    variant={a === 'cancel' || a === 'report' ? 'outline' : 'primary'}
                    loading={busy === a} disabled={busy !== null && busy !== a}
                    onPress={() => onAction(a)} />
                );
              })}
            </View>
          ) : null}
        </>
      )}
    </ScreenScaffold>
  );
}

function Breakdown({ label, minor, cc, lang, strong }: { label: string; minor: string; cc: string; lang: string; strong?: boolean }) {
  return (
    <View style={[styles.brRow, strong && styles.brStrong]}>
      <Text style={[styles.brLabel, strong && styles.brLabelStrong]}>{label}</Text>
      <MoneyText minor={minor} currencyCode={cc} langCode={lang} size={strong ? 'lg' : 'md'} tone={strong ? 'default' : 'muted'} />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space[3] },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2], paddingVertical: space[2], borderTopWidth: 1, borderTopColor: color.ink100 },
  itemName: { flex: 1, fontFamily: font.body, fontSize: font.size.md, color: color.ink800 },
  itemQty: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500 },
  brRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space[2] },
  brStrong: { borderTopWidth: 1, borderTopColor: color.ink100, marginTop: space[1], paddingTop: space[3] },
  brLabel: { fontFamily: font.body, fontSize: font.size.md, color: color.ink500 },
  brLabelStrong: { color: color.ink800, fontWeight: font.weight.semibold },
  actions: { marginTop: space[4], gap: space[3] },
});
