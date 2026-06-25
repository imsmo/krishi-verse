// apps/mobile/src/app/(buyer)/auctions/[id].tsx · auction detail + watch-live (screens 16/65/194) + outbid banner
// (193) + ended state (66). Thin screen (guide §3): loads the auction + bid history, POLLS every 4s while focused
// (live-ish; degrades to manual refresh). Current price/min-next-bid come from the PURE auction-status helpers
// (Law 2 bigint). "Place bid" → the bid screen while biddable. EMD is held SERVER-SIDE (we show a note, not a
// fabricated amount — the read-model doesn't expose it). Behind `auctions`. Degrade-never-die.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Auction, BidHistoryItem } from '@krishi-verse/sdk-js';
import { Button, Card, EmptyState, MoneyText, StatusPill, ScreenScaffold, SkeletonCard, color, font, space, radius } from '@krishi-verse/ui-native';
import { formatRelative } from '@krishi-verse/i18n';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { useAuth } from '../../../core/auth/auth.store';
import { getAuction, bidHistory, isWatchingAuction, watchAuction, unwatchAuction } from '../../../features/auctions/auctions.api';
import { getPublicListing } from '../../../features/buyer/browse.api';
import { auctionStatusTone, isBiddable, currentPriceMinor, minNextBidMinor, isOutbid } from '../../../features/auctions/auction-status';

const POLL_MS = 4000;

export default function AuctionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang } = useTranslation();
  const router = useRouter();
  const { state } = useAuth();
  const myId = state.profile?.id ?? '';
  const enabled = useFlag('auctions');
  const [auction, setAuction] = useState<Auction | null>(null);
  const [bids, setBids] = useState<BidHistoryItem[]>([]);
  const [title, setTitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [watching, setWatching] = useState(false);
  const [watchBusy, setWatchBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (!id) return;
    const a = await getAuction(id);
    setAuction(a); setFailed(!a);
    if (a) { const h = await bidHistory(id); setBids(h.items); }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (!enabled || !id) return;
    refresh();
    timer.current = setInterval(refresh, POLL_MS);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [enabled, id, refresh]);

  // Fetch the product title once (public listing read).
  useEffect(() => { if (auction && title === null) getPublicListing(auction.listingId).then((l) => setTitle(l?.title ?? '')); }, [auction, title]);

  // Load the caller's watch state once the auction is known (best-effort; the toggle reflects server truth).
  useEffect(() => { if (id && auction) isWatchingAuction(id).then(setWatching); }, [id, auction]);

  // Toggle watch/unwatch. Optimistic flip with rollback on failure (degrade-never-die; no money moves).
  const toggleWatch = useCallback(async () => {
    if (!id || watchBusy) return;
    setWatchBusy(true);
    const next = !watching; setWatching(next);
    try { const r = next ? await watchAuction(id) : await unwatchAuction(id); setWatching(r.watching); }
    catch { setWatching(!next); }
    finally { setWatchBusy(false); }
  }, [id, watching, watchBusy]);

  if (!enabled) return <ScreenScaffold title={t('auction.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const current = auction ? currentPriceMinor(auction, bids) : '0';
  const minNext = auction ? minNextBidMinor(current, auction.minIncrementMinor) : '0';
  const biddable = !!auction && isBiddable(auction.status);
  const outbid = isOutbid(bids, myId);

  return (
    <ScreenScaffold
      title={title || t('auction.title')} scroll={false}
      footer={biddable ? <Button title={t('auction.placeBid')} onPress={() => router.push({ pathname: '/(buyer)/auctions/bid', params: { id: id!, minNextMinor: minNext } })} /> : undefined}
    >
      {loading ? <SkeletonCard lines={5} /> : !auction || failed ? (
        <EmptyState title={t('auction.unavailable')} actionLabel={t('common.retry')} onAction={refresh} />
      ) : (
        <>
          {outbid && biddable ? <View style={styles.outbid}><Text style={styles.outbidText}>{t('auction.outbid')}</Text></View> : null}
          <Card>
            <View style={styles.head}>
              <StatusPill label={t(`auction.status.${auction.status}`)} tone={auctionStatusTone(auction.status)} />
              {biddable ? <Text style={styles.endsIn}>{t('auction.endsIn', { rel: safeRel(auction.endsAt, lang) })}</Text> : null}
            </View>
            <Text style={styles.label}>{t('auction.currentPrice')}</Text>
            <MoneyText minor={current} langCode={lang} size="3xl" />
            {biddable ? <Text style={styles.minNext}>{t('auction.minNext')} <MoneyText minor={minNext} langCode={lang} size="sm" /></Text> : null}
            <Text style={styles.emd}>{t('auction.emdNote')}</Text>
            <View style={styles.watchRow}>
              <Button title={watching ? t('auction.unwatch') : t('auction.watch')} variant="outline" loading={watchBusy} onPress={toggleWatch} />
              <Text style={styles.watchHint}>{t('auction.watchHint')}</Text>
            </View>
          </Card>

          <Text style={styles.section}>{t('auction.history')}</Text>
          <FlatList
            data={bids}
            keyExtractor={(b) => b.id}
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: color.ink100 }} />}
            ListEmptyComponent={<EmptyState title={t('auction.noBids')} />}
            renderItem={({ item }) => (
              <View style={styles.bidRow}>
                <Text style={styles.bidder}>{item.bidderUserId === myId ? t('auction.you') : t('auction.aBidder')}</Text>
                {item.amountMinor ? <MoneyText minor={item.amountMinor} langCode={lang} size="md" /> : <Text style={styles.sealed}>{t('auction.sealed')}</Text>}
              </View>
            )}
          />
        </>
      )}
    </ScreenScaffold>
  );
}

function safeRel(value: string, langCode: string): string { try { return formatRelative(value, langCode); } catch { return ''; } }

const styles = StyleSheet.create({
  outbid: { backgroundColor: color.dangerLight, borderRadius: radius.md, padding: space[3], marginBottom: space[3] },
  outbidText: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.dangerDark },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space[3] },
  endsIn: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500 },
  label: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500 },
  minNext: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink600, marginTop: space[2] },
  emd: { fontFamily: font.body, fontSize: font.size.xs, color: color.ink400, marginTop: space[3] },
  watchRow: { marginTop: space[3], gap: space[1] },
  watchHint: { fontFamily: font.body, fontSize: font.size.xs, color: color.ink400 },
  section: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink700, marginTop: space[4], marginBottom: space[2] },
  bidRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space[3] },
  bidder: { fontFamily: font.body, fontSize: font.size.md, color: color.ink700 },
  sealed: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink400 },
});
