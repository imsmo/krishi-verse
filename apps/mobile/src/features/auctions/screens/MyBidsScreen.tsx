// apps/mobile/src/features/auctions/screens/MyBidsScreen.tsx · design screen 18 (my bids, cross-auction).
// Thin screen (guide §3): the caller's OWN bids across ALL auctions via features/auctions (keyset load-more),
// each row showing the bid amount, the EMD hold, the auction status, and a winning badge. Tap → the auction
// detail. Behind the `auctions` flag. FLAG_SECURE (money on screen). Degrade-never-die: a failed read → empty.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import type { MyBid } from '@krishi-verse/sdk-js';
import { Button, EmptyState, MoneyText, StatusPill, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { listMyBids } from '../auctions.api';
import { auctionStatusTone } from '../auction-status';
import { useSecureScreen } from '../../../core/security';

export function MyBidsScreen() {
  useSecureScreen(); // bid amounts + EMD on screen — FLAG_SECURE (§4)
  const { t, lang } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('auctions');
  const [rows, setRows] = useState<MyBid[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (next?: string) => {
    setLoading(true);
    const page = await listMyBids(next);
    setRows((prev) => (next ? [...prev, ...page.items] : page.items));
    setCursor(page.nextCursor);
    setLoading(false);
  }, []);
  useEffect(() => { if (enabled) load(); }, [enabled, load]);

  if (!enabled) return <ScreenScaffold title={t('auction.myBids')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  return (
    <ScreenScaffold title={t('auction.myBids')} scroll={false}>
      {loading && rows.length === 0 ? <SkeletonCard lines={4} /> : (
        <FlatList
          data={rows}
          keyExtractor={(b) => b.bidId}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListEmptyComponent={<EmptyState title={t('auction.myBidsEmpty.title')} message={t('auction.myBidsEmpty.message')} />}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => router.push({ pathname: '/(buyer)/auctions/[id]', params: { id: item.auctionId } })} accessibilityRole="button">
              <View style={styles.left}>
                <View style={styles.headRow}>
                  <StatusPill label={t(`auction.status.${item.auctionStatus}`)} tone={auctionStatusTone(item.auctionStatus)} />
                  {item.isWinning ? <Text style={styles.winning}>{t('auction.winning')}</Text> : null}
                </View>
                <Text style={styles.emd}>{t('auction.emdHeld')} <MoneyText minor={item.emdHeldMinor} langCode={lang} size="xs" tone="muted" /></Text>
              </View>
              <MoneyText minor={item.amountMinor} langCode={lang} size="md" />
            </Pressable>
          )}
          ListFooterComponent={cursor ? <View style={{ marginTop: space[3] }}><Button title={t('common.loadMore')} variant="outline" loading={loading} onPress={() => load(cursor)} /></View> : null}
        />
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  sep: { height: 1, backgroundColor: color.ink100 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space[3] },
  left: { flex: 1, gap: space[1] },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  winning: { fontFamily: font.body, fontSize: font.size.xs, fontWeight: font.weight.semibold, color: color.successDark },
  emd: { fontFamily: font.body, fontSize: font.size.xs, color: color.ink400 },
});
