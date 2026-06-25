// apps/web-storefront/src/app/[tenantSlug]/listings/[id]/page.tsx · a single listing detail page. SSR-fetched via
// the SDK (anonymous public read); a missing/unavailable listing renders notFound() (404). Enriched with a price/
// quantity block, the localized sale-type, a seller trust card + listing review summary (both via the public
// reviews.summary aggregate — degrade silently if unavailable), the buyer CTAs (BuyerActions), a farm-to-fork
// note, and rich OpenGraph metadata for sharing. Money via formatMoneyMinor from minor-unit strings (Law 2).
//
// P1-1: the listing photo gallery is served by the dedicated signed endpoint `listings/:id/media` (short-lived
// presigned GET urls, CLEAN assets only, public listings only) — NOT embedded in the cacheable ListingCard
// read-model (its urls expire in minutes; embedding them in a revalidate=60 card would serve dead links). We
// fetch it alongside the listing and render a real gallery; an empty/unavailable gallery shows nothing (never a
// placeholder image).
// STILL FLAGGED — the ListingCard read-model carries no trace qrToken and no auctionId, so a /trace/[qrToken]
// provenance deep-link and a place-bid-from-listing CTA remain out of scope (we link to the /help explainer).
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { formatMoneyMinor } from '@krishi-verse/i18n';
import type { ListingCard, ReviewSummary, GalleryItem } from '@krishi-verse/sdk-js';
import { SdkError } from '@krishi-verse/sdk-js';
import { publicClient } from '../../../../lib/api-client';
import { getTranslator, getLang } from '../../../../lib/i18n';
import { BuyerActions } from '../../../../components/BuyerActions';
import { ListingGallery } from '../../../../components/ListingGallery';

export const revalidate = 60;

async function load(tenantSlug: string, id: string): Promise<ListingCard | null> {
  try { return await publicClient(tenantSlug).listings.get(id); }
  catch (e) { if (e instanceof SdkError && e.isNotFound) return null; throw e; }
}

/** The signed photo gallery degrades to [] — a flaky/empty media service never breaks the product page. */
async function safeGallery(tenantSlug: string, id: string): Promise<GalleryItem[]> {
  try { return await publicClient(tenantSlug).listings.media(id); } catch { return []; }
}

/** Public review aggregates degrade to null — a flaky/optional reviews service never breaks the product page. */
async function safeSummary(tenantSlug: string, q: { listingId?: string; targetUserId?: string }): Promise<ReviewSummary | null> {
  try { return await publicClient(tenantSlug).reviews.summary(q); } catch { return null; }
}

export async function generateMetadata({ params }: { params: { tenantSlug: string; id: string } }): Promise<Metadata> {
  const l = await load(params.tenantSlug, params.id);
  const t = getTranslator();
  if (!l) return { title: t.t('common.notFoundTitle'), robots: { index: false } };
  const desc = `${l.title} — ${formatMoneyMinor(l.priceMinor, l.currencyCode)} / ${l.unitCode}`;
  const canonical = `/${params.tenantSlug}/listings/${params.id}`;
  return {
    title: l.title,
    description: desc,
    alternates: { canonical },
    openGraph: { title: l.title, description: desc, type: 'website', url: canonical },
    twitter: { card: 'summary', title: l.title, description: desc },
  };
}

function Stars({ summary, label, none }: { summary: ReviewSummary | null; label: string; none: string }) {
  if (!summary || summary.count <= 0) return <p className="kv-rating kv-rating--none">{none}</p>;
  const avg = Math.round(summary.averageStars * 10) / 10;
  const full = Math.round(avg);
  return (
    <p className="kv-rating">
      <span aria-hidden="true" className="kv-rating__stars">{'★'.repeat(full)}{'☆'.repeat(Math.max(0, 5 - full))}</span>
      <span>{label}</span>
    </p>
  );
}

export default async function ListingDetail(
  { params, searchParams }: { params: { tenantSlug: string; id: string }; searchParams: { status?: string } },
) {
  const l = await load(params.tenantSlug, params.id);
  if (!l) notFound();
  const t = getTranslator();
  const lang = getLang();

  const [listingReviews, sellerReviews, gallery] = await Promise.all([
    safeSummary(params.tenantSlug, { listingId: l.id }),
    safeSummary(params.tenantSlug, { targetUserId: l.sellerUserId }),
    safeGallery(params.tenantSlug, l.id),
  ]);

  const status = searchParams.status;
  const notice =
    status === 'added' ? { kind: 'ok', msg: t.t('listing.statusAdded'), cta: true } :
    status === 'offer_sent' ? { kind: 'ok', msg: t.t('listing.statusOfferSent'), cta: false } :
    status === 'err' ? { kind: 'err', msg: t.t('listing.statusError'), cta: false } : null;

  return (
    <article className="kv-detail">
      {notice && (
        <p className={notice.kind === 'ok' ? 'kv-form__notice' : 'kv-form__error'} role="status">
          {notice.msg}{notice.cta && <> <Link href="/cart" className="kv-link">{t.t('listing.viewCart')}</Link></>}
        </p>
      )}

      <h1>{l.title}</h1>

      <ListingGallery
        items={gallery}
        title={l.title}
        heading={t.t('listing.galleryTitle')}
        alt={(index, total) => t.t('listing.photoAlt', { title: l.title, index: String(index), total: String(total) })}
      />

      <p className="kv-card__price kv-detail__price">
        {formatMoneyMinor(l.priceMinor, l.currencyCode, lang)} <span className="kv-card__unit">/ {l.unitCode}</span>
      </p>

      <ul className="kv-detail__facts">
        <li>{l.quantityAvailable} {l.unitCode} {t.t('card.available')}</li>
        <li>{t.t('discover.saleType')}: {t.t(`discover.saleType.${l.saleType}`)}</li>
        {l.organicClaim && <li><span className="kv-badge kv-badge--organic">{t.t('card.organic')}</span></li>}
      </ul>

      <BuyerActions listing={l} tenantSlug={params.tenantSlug} />

      <section className="kv-detail__section" aria-labelledby="seller-h">
        <h2 id="seller-h">{t.t('listing.sellerTitle')}</h2>
        <Stars
          summary={sellerReviews}
          label={sellerReviews && sellerReviews.count > 0 ? t.t('listing.sellerRating', { avg: String(Math.round(sellerReviews.averageStars * 10) / 10), count: String(sellerReviews.count) }) : ''}
          none={t.t('listing.sellerNoRatings')}
        />
      </section>

      <section className="kv-detail__section" aria-labelledby="reviews-h">
        <h2 id="reviews-h">{t.t('listing.reviewsTitle')}</h2>
        <Stars
          summary={listingReviews}
          label={listingReviews && listingReviews.count > 0 ? t.t('listing.reviewsSummary', { avg: String(Math.round(listingReviews.averageStars * 10) / 10), count: String(listingReviews.count) }) : ''}
          none={t.t('listing.reviewsNone')}
        />
      </section>

      <section className="kv-detail__section" aria-labelledby="trace-h">
        <h2 id="trace-h">{t.t('listing.traceTitle')}</h2>
        <p className="kv-detail__muted">{t.t('listing.traceNote')}</p>
        <Link href="/help" className="kv-link">{t.t('listing.traceLink')}</Link>
      </section>
    </article>
  );
}
