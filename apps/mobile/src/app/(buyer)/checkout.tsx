// apps/mobile/src/app/(buyer)/checkout.tsx · screen 15 (checkout). Thin screen (guide §3): pick a delivery address
// (from the book), enter an optional coupon, see the cart subtotal, then PLACE the order — a REAL, idempotent
// cart→orders conversion (Law 3). The authoritative totals (delivery/discount/tax/commission) + coupon discount
// are computed SERVER-SIDE and shown on the resulting order (we never compute them client-side). If online
// payments are enabled, we then pay the primary order via the gateway (escrow held server-side on capture — the
// client never moves money, Law 11). FLAG_SECURE (payment surface). Behind `buyer_checkout`. Degrade-never-die.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SdkError, type Address, type Cart } from '@krishi-verse/sdk-js';
import { Button, Card, Input, EmptyState, MoneyText, ScreenScaffold, SkeletonCard, color, font, space, radius } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { useSecureScreen } from '../../core/security/screen-guard';
import { getCart, placeOrder } from '../../features/cart/cart.api';
import { listAddresses } from '../../features/addresses/addresses.api';
import { formatAddress } from '../../features/cart/cart-math';
import { payForOrder } from '../../features/payments/payments.api';

export default function Checkout() {
  useSecureScreen();
  const { t, lang } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('buyer_checkout');
  const payEnabled = useFlag('payments_addmoney');

  const [cart, setCart] = useState<Cart | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [coupon, setCoupon] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const load = useCallback(async () => {
    setLoading(true);
    const [c, a] = await Promise.all([getCart(), listAddresses()]);
    setCart(c); setAddresses(a);
    setAddressId((prev) => prev ?? a.find((x) => x.isDefault)?.id ?? a[0]?.id ?? null);
    setLoading(false);
  }, []);
  useEffect(() => { if (enabled) load(); }, [enabled, load]);

  if (!enabled) return <ScreenScaffold title={t('checkout.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const onPlace = async () => {
    setBusy(true); setError(undefined);
    try {
      const res = await placeOrder({ deliveryAddressId: addressId ?? undefined, couponCode: coupon.trim() || undefined });
      const primary = res.orders[0];
      if (!primary) { setError(t('checkout.failed')); return; }
      // Pay the primary order if online payments are on; escrow held server-side on capture.
      if (payEnabled && primary.totalMinor !== '0') {
        try { await payForOrder(primary.id, primary.totalMinor); } catch { /* payment can be retried from the order; order is placed */ }
      }
      router.replace({ pathname: '/(buyer)/orders/[id]', params: { id: primary.id, notice: t('checkout.placed') } });
    } catch (e) {
      setError(e instanceof SdkError && e.status === 409 ? t('checkout.changed')
        : e instanceof SdkError && (e.isValidation || e.status === 422) ? t('checkout.couponInvalid') : t('checkout.failed'));
    } finally { setBusy(false); }
  };

  const canPlace = !!cart && cart.items.length > 0 && !!addressId && !busy;

  return (
    <ScreenScaffold
      title={t('checkout.title')}
      footer={<Button title={t('checkout.place')} onPress={onPlace} loading={busy} disabled={!canPlace} />}
    >
      {loading ? <SkeletonCard lines={5} /> : (
        <>
          <Text style={styles.section}>{t('checkout.deliverTo')}</Text>
          {addresses.length === 0 ? (
            <Card><Text style={styles.noAddr}>{t('checkout.noAddress')}</Text>
              <Pressable onPress={() => router.push('/(buyer)/addresses')} accessibilityRole="button"><Text style={styles.link}>{t('address.add')}</Text></Pressable>
            </Card>
          ) : addresses.map((a) => {
            const active = addressId === a.id;
            return (
              <Pressable key={a.id} onPress={() => setAddressId(a.id)} style={[styles.addr, active && styles.addrOn]} accessibilityRole="radio" accessibilityState={{ selected: active }} accessibilityLabel={formatAddress(a)}>
                <Text style={[styles.addrText, active && styles.addrTextOn]} numberOfLines={2}>{formatAddress(a)}</Text>
              </Pressable>
            );
          })}

          <Text style={styles.section}>{t('checkout.coupon')}</Text>
          <Input label={t('checkout.couponLabel')} value={coupon} onChangeText={setCoupon} autoCapitalize="characters" maxLength={40} error={error} />

          <Card style={{ marginTop: space[4] }}>
            <View style={styles.totalRow}><Text style={styles.totalLabel}>{t('cart.subtotal')}</Text><MoneyText minor={cart?.subtotalMinor ?? '0'} langCode={lang} size="lg" /></View>
            <Text style={styles.note}>{t('checkout.totalsNote')}</Text>
          </Card>
        </>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  section: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink700, marginTop: space[4], marginBottom: space[2] },
  addr: { padding: space[4], borderRadius: radius.lg, borderWidth: 1.5, borderColor: color.ink200, backgroundColor: color.card, marginBottom: space[2], minHeight: 52 },
  addrOn: { borderColor: color.primary600, backgroundColor: color.primary50 },
  addrText: { fontFamily: font.body, fontSize: font.size.md, color: color.ink800 },
  addrTextOn: { color: color.primary800, fontWeight: font.weight.semibold },
  noAddr: { fontFamily: font.body, fontSize: font.size.md, color: color.ink600, marginBottom: space[2] },
  link: { fontFamily: font.body, fontSize: font.size.md, color: color.primary700, fontWeight: font.weight.semibold },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalLabel: { fontFamily: font.body, fontSize: font.size.md, color: color.ink600 },
  note: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink400, marginTop: space[2] },
});
