// apps/web-storefront/src/app/checkout/page.tsx · the checkout review. PROTECTED + dynamic (requireSession). Reads
// the authoritative cart + the buyer's saved addresses via the authed SDK, and renders the order review: delivery
// address choice, an optional coupon, and the cart subtotal. The final delivery/charges/discount/tax are computed
// SERVER-SIDE at placement and shown on the confirmation — there is no pre-placement preview endpoint in the SDK
// (see README "Checkout" flag), so we say so honestly rather than computing a fake total here. Placing the order
// is a Server Action carrying a hidden, per-render Idempotency-Key. Money via formatMoneyMinor (Law 2).
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { randomUUID } from 'crypto';
import Link from 'next/link';
import { formatMoneyMinor } from '@krishi-verse/i18n';
import type { Cart, Address } from '@krishi-verse/sdk-js';
import { serverClient } from '../../lib/api-client';
import { requireSession } from '../../lib/session';
import { getTranslator, getLang } from '../../lib/i18n';
import { placeOrderAction } from './actions';

const CURRENCY = 'INR'; // platform settlement currency (cart read-model carries no per-line currency code)

export function generateMetadata(): Metadata {
  const t = getTranslator();
  return { title: t.t('checkout.title'), robots: { index: false, follow: false } };
}

function addressLine(a: Address): string {
  return [a.line1, a.line2, a.village, a.pincode].filter(Boolean).join(', ');
}

export default async function CheckoutPage({ searchParams }: { searchParams: { status?: string } }) {
  await requireSession('/checkout');
  const t = getTranslator();
  const lang = getLang();

  let cart: Cart | null = null;
  let addresses: Address[] = [];
  try {
    [cart, addresses] = await Promise.all([serverClient().cart.get(), serverClient().addresses.list()]);
  } catch {
    cart = null;
  }

  if (!cart) {
    return (
      <section className="kv-checkout"><h1>{t.t('checkout.title')}</h1>
        <p className="kv-form__error" role="alert">{t.t('checkout.loadError')}</p>
      </section>
    );
  }
  if (cart.items.length === 0) redirect('/cart'); // nothing to check out

  const defaultAddr = addresses.find((a) => a.isDefault) ?? addresses[0];
  const idempotencyKey = randomUUID(); // per-render; resubmits of THIS review dedupe server-side

  return (
    <section className="kv-checkout">
      <h1>{t.t('checkout.title')}</h1>
      {searchParams.status === 'err' && <p className="kv-form__error" role="alert">{t.t('checkout.placeError')}</p>}

      <form action={placeOrderAction} className="kv-checkout__form">
        <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

        <fieldset className="kv-checkout__section">
          <legend>{t.t('checkout.deliveryAddress')}</legend>
          {addresses.length === 0 ? (
            <p className="kv-detail__muted">{t.t('checkout.noAddress')}</p>
          ) : (
            <ul className="kv-checkout__addrs">
              {addresses.map((a) => (
                <li key={a.id}>
                  <label className="kv-checkout__addr">
                    <input type="radio" name="deliveryAddressId" value={a.id} defaultChecked={a.id === defaultAddr?.id} />
                    <span>{a.contactName ? `${a.contactName} — ` : ''}{addressLine(a)}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        <fieldset className="kv-checkout__section">
          <legend>{t.t('checkout.couponLegend')}</legend>
          <label htmlFor="coupon" className="kv-field__label">{t.t('checkout.couponLabel')}</label>
          <input id="coupon" name="couponCode" type="text" maxLength={40} className="kv-field__input kv-checkout__coupon" autoCapitalize="characters" />
          <p className="kv-field__hint">{t.t('checkout.couponHint')}</p>
        </fieldset>

        <div className="kv-checkout__summary">
          <p className="kv-cart__subtotal"><span>{t.t('cart.subtotal')}</span> <strong>{formatMoneyMinor(cart.subtotalMinor, CURRENCY, lang)}</strong></p>
          <p className="kv-cart__note">{t.t('checkout.totalsNote')}</p>
          <button type="submit" className="kv-btn">{t.t('checkout.placeOrder')}</button>
          <Link href="/cart" className="kv-btn--link">{t.t('checkout.backToCart')}</Link>
        </div>
      </form>
    </section>
  );
}
