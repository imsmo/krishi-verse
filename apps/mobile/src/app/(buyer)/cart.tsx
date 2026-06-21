// apps/mobile/src/app/(buyer)/cart.tsx · screen 96 (cart). Thin screen (guide §3): the SERVER's cart (live prices/
// availability) → adjust qty (±, within stock), remove, see subtotal (Law 2 MoneyText), and proceed to checkout.
// canCheckout/blockers come from the PURE cart-math. Behind `buyer_checkout`. Degrade-never-die: empty/failed →
// friendly state.
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import type { Cart, CartItem } from '@krishi-verse/sdk-js';
import { Button, Card, EmptyState, MoneyText, ScreenScaffold, SkeletonCard, color, font, space, radius } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { getCart, setCartQuantity, removeFromCart } from '../../features/cart/cart.api';
import { canCheckout, clampQuantity } from '../../features/cart/cart-math';

export default function CartScreen() {
  const { t, lang } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('buyer_checkout');
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => { setCart(await getCart()); setLoading(false); }, []);
  useFocusEffect(useCallback(() => { if (enabled) { setLoading(true); load(); } }, [enabled, load]));

  if (!enabled) return <ScreenScaffold title={t('cart.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const step = async (it: CartItem, delta: number) => {
    const q = clampQuantity(it.quantity, delta, it.available);
    if (q === it.quantity) return;
    setBusy(true); try { setCart(await setCartQuantity(it.listingId, q)); } finally { setBusy(false); }
  };
  const remove = async (it: CartItem) => { setBusy(true); try { setCart(await removeFromCart(it.listingId)); } finally { setBusy(false); } };

  const ready = canCheckout(cart);

  return (
    <ScreenScaffold
      title={t('cart.title')} scroll={false}
      footer={cart && cart.items.length > 0 ? (
        <View style={styles.footer}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t('cart.subtotal')}</Text>
            <MoneyText minor={cart.subtotalMinor} langCode={lang} size="xl" />
          </View>
          <Button title={t('cart.checkout')} onPress={() => router.push('/(buyer)/checkout')} disabled={!ready || busy} />
        </View>
      ) : undefined}
    >
      {loading ? <View style={{ gap: space[3] }}><SkeletonCard /><SkeletonCard /></View> : (
        <FlatList
          data={cart?.items ?? []}
          keyExtractor={(i) => i.listingId}
          ItemSeparatorComponent={() => <View style={{ height: space[2] }} />}
          ListEmptyComponent={<EmptyState title={t('cart.empty.title')} message={t('cart.empty.message')} />}
          renderItem={({ item }) => (
            <Card>
              <Text style={styles.name} numberOfLines={1}>{item.title ?? t('cart.item')}</Text>
              <View style={styles.row}>
                <View style={styles.stepper}>
                  <Pressable onPress={() => step(item, -1)} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel={t('cart.decrease')}><Text style={styles.stepGlyph}>−</Text></Pressable>
                  <Text style={styles.qty}>{item.quantity}</Text>
                  <Pressable onPress={() => step(item, +1)} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel={t('cart.increase')}><Text style={styles.stepGlyph}>+</Text></Pressable>
                </View>
                <MoneyText minor={item.lineTotalMinor} langCode={lang} size="lg" />
              </View>
              {!item.purchasable ? <Text style={styles.warn}>{t('cart.warn.unavailable')}</Text>
                : item.quantity > item.available ? <Text style={styles.warn}>{t('cart.warn.insufficient', { n: item.available })}</Text>
                : item.priceChanged ? <Text style={styles.note}>{t('cart.warn.priceChanged')}</Text> : null}
              <Pressable onPress={() => remove(item)} hitSlop={8} accessibilityRole="button"><Text style={styles.remove}>{t('cart.remove')}</Text></Pressable>
            </Card>
          )}
        />
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  name: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800, marginBottom: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  stepBtn: { width: 40, height: 40, borderRadius: radius.md, borderWidth: 1.5, borderColor: color.ink200, alignItems: 'center', justifyContent: 'center' },
  stepGlyph: { fontSize: 22, color: color.ink700 },
  qty: { fontFamily: font.body, fontSize: font.size.lg, fontWeight: font.weight.semibold, color: color.ink800, minWidth: 28, textAlign: 'center' },
  warn: { fontFamily: font.body, fontSize: font.size.sm, color: color.dangerDark, marginTop: space[2] },
  note: { fontFamily: font.body, fontSize: font.size.sm, color: color.warningDark, marginTop: space[2] },
  remove: { fontFamily: font.body, fontSize: font.size.sm, color: color.primary700, marginTop: space[2] },
  footer: { gap: space[3] },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalLabel: { fontFamily: font.body, fontSize: font.size.md, color: color.ink600 },
});
