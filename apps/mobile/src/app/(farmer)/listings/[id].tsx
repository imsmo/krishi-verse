// apps/mobile/src/app/(farmer)/listings/[id].tsx · screen 112 (My Listing detail) — rebuilt to the Phase-1
// design (Krishi_Verse_Design_System/screens/112-farmer-my-listing-detail.html): crop hero + status badge +
// photo count, title + ₹/quintal + meta line, a 7-day stats strip (Views · Inquiries · Offers), four quick
// actions (Edit · Boost · Stats · Remove), Recent inquiries, and a Listing-health checklist. Thin screen over
// features/listings; degrade-never-die (Law 12); money via MoneyText (paise); ≥48px targets; i18n(hi/en/gu).
//
// Real data: title/price/qty/status (GET /listings/:id), Views + Offers + publishedAt (GET /listings/:id/analytics,
// owner-only — anti-IDOR), photo count (GET /listings/:id/media). Edit is real; Boost is flag-gated (listing_boost
// OFF until wallet pay lands) — never a fake boosted state. FLAGGED GAPS (§13, never faked): Inquiries count, the
// Recent-inquiries list, grade/moisture, fair-price + verified-location chips, lab-report/expiry health rows, and
// a listing Remove endpoint are not exposed by the read-model/SDK yet → shown as "—" / hidden / "coming soon".
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ListingCard, ListingAnalytics } from '@krishi-verse/sdk-js';
import { EmptyState, MoneyText, SkeletonCard, Icon, color, font, space, radius, shadow } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { getListing, listingAnalytics, listingMedia } from '../../../features/listings/listings.api';
import { relativeAge, healthItems, type RelativeAge } from '../../../features/listings/listing-detail';
import { cropEmoji } from '../../../features/listings/my-listings';

function ageLabel(t: (k: string, p?: Record<string, unknown>) => string, a: RelativeAge | null): string | null {
  if (!a) return null;
  if (a.unit === 'today') return t('listingDetail.listedToday');
  return t(`listingDetail.listedAgo.${a.unit}`, { n: a.value });
}

export default function ListingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang } = useTranslation();
  const router = useRouter();
  const boostOn = useFlag('listing_boost');
  const [listing, setListing] = useState<ListingCard | null>(null);
  const [analytics, setAnalytics] = useState<ListingAnalytics | null>(null);
  const [photoCount, setPhotoCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true); setFailed(false);
    const [res, an, media] = await Promise.all([getListing(id), listingAnalytics(id), listingMedia(id)]);
    setListing(res.listing); setFailed(!res.listing);
    setAnalytics(an); setPhotoCount(media.length);
    setLoading(false);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const onEdit = () => router.push({ pathname: '/(farmer)/listings/edit', params: { id: id! } });
  // Boost (screen 114) is a real paid action: wallet → chosen boost tier (server-resolved price). Gated behind
  // listing_boost; the tile only shows when the flag is on, and routes to the boost screen. Remove has no
  // unpublish/delete endpoint yet → flagged coming-soon (never faked).
  const onBoost = () => router.push({ pathname: '/(farmer)/listings/boost', params: { id: id! } });
  // Repost (screen 116) — real re-publish for a fresh window; surfaced for expired/sold-out listings only.
  const onRepost = () => router.push({ pathname: '/(farmer)/listings/repost', params: { id: id! } });
  const onRemove = () => Alert.alert(t('listingDetail.remove'), t('listingDetail.removeSoon'));

  const statusKey = listing?.status === 'draft' ? 'preview.status.draft' : listing?.status === 'sold' ? 'listings.badge.sold' : 'listingDetail.statusActive';
  const listed = ageLabel(t, relativeAge(analytics?.publishedAt));
  const health = listing ? healthItems({ photoCount, boostActive: !!analytics?.activeBoost }) : [];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.appbar}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.back')} hitSlop={8} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={color.ink700} />
        </Pressable>
        <Text style={styles.appbarTitle}>{t('listingDetail.title')}</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.body}><SkeletonCard lines={3} /><View style={{ height: space[3] }} /><SkeletonCard lines={5} /></View>
      ) : !listing || failed ? (
        <View style={styles.body}><EmptyState title={t('listings.unavailable')} actionLabel={t('common.retry')} onAction={load} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <View style={styles.hero}>
            <Text style={styles.heroEmoji}>{cropEmoji(listing.title)}</Text>
            <View style={styles.heroBadge}><Text style={styles.heroBadgeTxt}>✓ {t(statusKey)}</Text></View>
            {photoCount > 0 ? <View style={styles.photoTag}><Text style={styles.photoTagTxt}>📷 {t('listingDetail.photos', { n: photoCount })}</Text></View> : null}
          </View>

          {/* Title + price + meta */}
          <Text style={styles.title}>{listing.title}</Text>
          <View style={styles.priceRow}>
            <MoneyText minor={listing.priceMinor} currencyCode={listing.currencyCode} langCode={lang} size="xl" />
            <Text style={styles.perUnit}> / {listing.unitCode}</Text>
          </View>
          <Text style={styles.meta}>
            {t('listingDetail.available', { n: listing.quantityAvailable, unit: listing.unitCode })}
            {listing.organicClaim ? ` · ${t('listings.organic')}` : ''}
            {listed ? ` · ${listed}` : ''}
          </Text>

          {/* 7-day stats */}
          <Text style={styles.sectionLabel}>{t('listingDetail.last7')}</Text>
          <View style={styles.statsRow}>
            <StatCell value={analytics ? String(analytics.views) : '—'} label={t('listingDetail.views')} tone={color.primary600} />
            {/* Inquiries: no listing-scoped inquiry count in the read-model yet (§13 gap) — shown as "—", never faked. */}
            <StatCell value="—" label={t('listingDetail.inquiries')} tone={color.info} />
            <StatCell value={analytics ? String(analytics.offers) : '—'} label={t('listingDetail.offers')} tone={color.accent700} />
          </View>

          {/* Quick actions */}
          <View style={styles.actions}>
            <ActionTile icon="✏️" label={t('listingDetail.edit')} onPress={onEdit} />
            {listing.status === 'expired' || listing.status === 'sold_out' ? <ActionTile icon="♻️" label={t('listingDetail.repost')} onPress={onRepost} /> : null}
            {boostOn ? <ActionTile icon="🚀" label={t('listingDetail.boost')} onPress={onBoost} /> : null}
            <ActionTile icon="📊" label={t('listingDetail.stats')} onPress={() => router.push({ pathname: '/(farmer)/listings/analytics', params: { id: id! } })} />
            <ActionTile icon="🗑" label={t('listingDetail.remove')} onPress={onRemove} danger />
          </View>

          {/* Recent inquiries — header + designed empty/flag (no listing-scoped inquiry list endpoint yet, §13). */}
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>{t('listingDetail.recentInquiries')}</Text>
            {analytics && analytics.offers > 0 ? <Text style={styles.viewAll}>{t('listingDetail.viewAll', { n: analytics.offers })} →</Text> : null}
          </View>
          <View style={styles.inqEmpty}>
            <Text style={styles.inqEmptyTxt}>{t('listingDetail.inquiriesSoon')}</Text>
          </View>

          {/* Listing health (from real photo count + boost; lab-report/expiry rows flagged) */}
          <Text style={[styles.sectionTitle, { marginTop: space[5], marginBottom: space[2] }]}>{t('listingDetail.health')}</Text>
          <View style={styles.healthCard}>
            {health.map((h) => (
              <View key={h.id} style={styles.healthRow}>
                <Text style={[styles.healthIcon, { color: h.tone === 'good' ? color.successDark : color.accent700 }]}>{h.tone === 'good' ? '✓' : '⚠'}</Text>
                <Text style={styles.healthTxt}>{t(h.labelKey, { n: h.count })}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function StatCell({ value, label, tone }: { value: string; label: string; tone: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={[styles.statVal, { color: tone }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}
function ActionTile({ icon, label, onPress, danger }: { icon: string; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable style={styles.tile} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={styles.tileIcon}>{icon}</Text>
      <Text style={[styles.tileLabel, danger && { color: color.dangerDark }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.page },
  appbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[2] },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: color.card, borderWidth: 1, borderColor: color.earth200 },
  appbarTitle: { fontFamily: font.display, fontSize: font.size.lg, fontWeight: font.weight.bold, color: color.ink800 },
  body: { flex: 1, padding: space[5] },
  scroll: { paddingHorizontal: space[5], paddingBottom: space[6] },

  hero: { height: 180, borderRadius: radius.lg, backgroundColor: color.primary50, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: color.earth200, overflow: 'hidden' },
  heroEmoji: { fontSize: 72 },
  heroBadge: { position: 'absolute', top: space[3], left: space[3], backgroundColor: color.successLight, borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: 10 },
  heroBadgeTxt: { fontFamily: font.body, fontSize: font.size.xs, fontWeight: font.weight.bold, color: color.successDark, letterSpacing: 0.4 },
  photoTag: { position: 'absolute', bottom: space[3], right: space[3], backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: 10 },
  photoTagTxt: { fontFamily: font.body, fontSize: font.size.xs, fontWeight: font.weight.semibold, color: color.white },

  title: { fontFamily: font.display, fontSize: font.size.xl, fontWeight: font.weight.bold, color: color.ink800, marginTop: space[4], letterSpacing: -0.3 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: space[1] },
  perUnit: { fontFamily: font.body, fontSize: font.size.md, color: color.ink500 },
  meta: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500, marginTop: space[1], lineHeight: 20 },

  sectionLabel: { fontFamily: font.body, fontSize: font.size.xs, fontWeight: font.weight.bold, color: color.ink400, letterSpacing: 0.5, marginTop: space[5], marginBottom: space[2], textTransform: 'uppercase' },
  statsRow: { flexDirection: 'row', gap: space[2] },
  statCell: { flex: 1, backgroundColor: color.card, borderWidth: 1, borderColor: color.earth200, borderRadius: radius.md, paddingVertical: space[3], alignItems: 'center', ...shadow.card },
  statVal: { fontFamily: font.display, fontSize: font.size['2xl'], fontWeight: font.weight.bold, letterSpacing: -0.3 },
  statLabel: { fontFamily: font.body, fontSize: font.size.xs, color: color.ink500, marginTop: 2 },

  actions: { flexDirection: 'row', gap: space[2], marginTop: space[4] },
  tile: { flex: 1, minHeight: 64, backgroundColor: color.card, borderWidth: 1, borderColor: color.earth200, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: space[2] },
  tileIcon: { fontSize: 22 },
  tileLabel: { fontFamily: font.body, fontSize: font.size.xs, fontWeight: font.weight.semibold, color: color.ink700 },

  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space[5], marginBottom: space[2] },
  sectionTitle: { fontFamily: font.display, fontSize: font.size.lg, fontWeight: font.weight.bold, color: color.ink800 },
  viewAll: { fontFamily: font.body, fontSize: font.size.sm, fontWeight: font.weight.semibold, color: color.primary700 },
  inqEmpty: { padding: space[4], borderRadius: radius.md, backgroundColor: color.card, borderWidth: 1, borderColor: color.earth200, borderStyle: 'dashed' },
  inqEmptyTxt: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500, textAlign: 'center' },

  healthCard: { backgroundColor: color.card, borderWidth: 1, borderColor: color.earth200, borderRadius: radius.lg, paddingHorizontal: space[4], ...shadow.card },
  healthRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3], borderTopWidth: 1, borderTopColor: color.ink100 },
  healthIcon: { fontSize: font.size.md, fontWeight: font.weight.bold, width: 18, textAlign: 'center' },
  healthTxt: { flex: 1, fontFamily: font.body, fontSize: font.size.sm, color: color.ink700 },
});
