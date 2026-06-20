// apps/mobile/src/app/(farmer)/listings/new.tsx · screen 10 (create listing) — now with PHOTOS + VOICE. Pick the
// product from the catalogue (gives the real productId/categoryId/unit — never fabricated), add up to 6 photos
// (core/media: compress + upload, with per-tile progress/retry), optionally DESCRIBE the crop by voice
// (core/voice on-device STT — fills free text only; we never auto-extract money/qty from speech, see flagged
// gap), then enter quantity + price (₹→paise via BigInt, Law 2). Submit CREATES a draft and goes to the preview
// screen (11) to publish. Offline → the create queues (Law 3 idempotent replay) and we return to the list.
// `?repostFrom=<id>` (116) prefills qty/price from an existing listing (the product is re-picked — the public
// card carries no productId).
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import type { ProductCard } from '@krishi-verse/sdk-js';
import { Button, Input, VoiceButton, AddMediaTile, UploadTile, ScreenScaffold, color, font, space, radius, type UploadStatus } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { searchProducts } from '../../../features/catalogue/catalogue.api';
import { createListing, getListing } from '../../../features/listings/listings.api';
import { captureFromCamera, pickFromGallery, uploadPickedImage, type PickedImage } from '../../../core/media';
import { useVoiceDictation } from '../../../core/voice';

interface Photo { key: string; uri: string; status: UploadStatus; progress: number; mediaId?: string }
const MAX_PHOTOS = 6;

export default function CreateListing() {
  const router = useRouter();
  const { t, lang } = useTranslation();
  const { repostFrom } = useLocalSearchParams<{ repostFrom?: string }>();
  const voice = useVoiceDictation(lang);

  const [q, setQ] = useState('');
  const [results, setResults] = useState<ProductCard[]>([]);
  const [product, setProduct] = useState<ProductCard | null>(null);
  const [qty, setQty] = useState('');
  const [rupees, setRupees] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // Repost: prefill qty + price from the source listing (product is re-picked).
  useEffect(() => {
    if (!repostFrom) return;
    (async () => {
      const { listing } = await getListing(repostFrom);
      if (listing) {
        setQty(String(listing.quantityAvailable ?? ''));
        try { setRupees((BigInt(listing.priceMinor) / 100n).toString()); } catch { /* ignore */ }
        setQ(listing.title ?? '');
      }
    })();
  }, [repostFrom]);

  // Voice transcript fills the description field.
  useEffect(() => { if (voice.transcript) setDescription(voice.transcript); }, [voice.transcript]);

  useEffect(() => {
    if (product || q.trim().length < 2) { setResults([]); return; }
    let live = true;
    const id = setTimeout(async () => { const items = await searchProducts(q, 8); if (live) setResults(items); }, 300);
    return () => { live = false; clearTimeout(id); };
  }, [q, product]);

  const priceMinor = useMemo(() => (/^\d{1,13}$/.test(rupees) ? (BigInt(rupees) * 100n).toString() : null), [rupees]);
  const uploadingAny = photos.some((p) => p.status === 'uploading');
  const canSubmit = !!product && /^\d{1,7}$/.test(qty) && Number(qty) > 0 && !!priceMinor && !busy && !uploadingAny;
  const mediaIds = photos.filter((p) => p.mediaId).map((p) => p.mediaId!) as string[];

  const addPhoto = async (pick: () => Promise<PickedImage | null>) => {
    if (photos.length >= MAX_PHOTOS) return;
    const picked = await pick();
    if (!picked) return;
    const key = `${Date.now()}:${photos.length}`;
    setPhotos((prev) => [...prev, { key, uri: picked.uri, status: 'uploading', progress: 0 }]);
    try {
      const res = await uploadPickedImage(picked, { onProgress: (f) => setPhotos((prev) => prev.map((p) => (p.key === key ? { ...p, progress: f } : p))) });
      setPhotos((prev) => prev.map((p) => (p.key === key ? { ...p, status: res.queued ? 'queued' : 'done', mediaId: res.mediaId ?? undefined } : p)));
    } catch {
      setPhotos((prev) => prev.map((p) => (p.key === key ? { ...p, status: 'failed' } : p)));
    }
  };
  const pickSource = () => Alert.alert(t('createListing.photoSource'), undefined, [
    { text: t('createListing.camera'), onPress: () => addPhoto(captureFromCamera) },
    { text: t('createListing.gallery'), onPress: () => addPhoto(pickFromGallery) },
    { text: t('common.cancel'), style: 'cancel' },
  ]);

  const onSubmit = async () => {
    if (!product || !priceMinor) return;
    setBusy(true); setError(undefined);
    try {
      const { id, queued } = await createListing({
        productId: product.id, categoryId: product.categoryId, title: product.name, description: description || undefined,
        quantityTotal: Number(qty), unitCode: product.defaultUnit || 'qtl', priceMinor, mediaIds: mediaIds.length ? mediaIds : undefined,
      });
      if (queued || !id) {
        Alert.alert(t('createListing.queued'), undefined, [{ text: 'OK', onPress: () => router.replace('/(farmer)/listings') }]);
      } else {
        router.replace({ pathname: '/(farmer)/listings/preview', params: { id } });
      }
    } catch { setError(t('createListing.error')); }
    finally { setBusy(false); }
  };

  return (
    <ScreenScaffold
      title={t('createListing.title')}
      footer={<Button title={t('createListing.submit')} onPress={onSubmit} loading={busy} disabled={!canSubmit} />}
    >
      {!product ? (
        <>
          <Input label={t('createListing.cropLabel')} value={q} onChangeText={setQ} autoFocus />
          <FlatList
            data={results}
            keyExtractor={(p) => p.id}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: color.ink100 }} />}
            renderItem={({ item }) => (
              <Pressable style={styles.result} onPress={() => { setProduct(item); setQ(item.name); }} accessibilityRole="button" accessibilityLabel={item.name}>
                <Text style={styles.resultName}>{item.name}</Text>
              </Pressable>
            )}
          />
        </>
      ) : (
        <>
          <Pressable onPress={() => { setProduct(null); setResults([]); }} style={styles.picked} accessibilityRole="button">
            <Text style={styles.pickedName}>{product.name}</Text>
            <Text style={styles.change}>{t('common.cancel')}</Text>
          </Pressable>

          <Text style={styles.section}>{t('createListing.photos')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[2] }}>
            {photos.map((p) => (
              <UploadTile key={p.key} uri={p.uri} status={p.status} progress={p.progress}
                queuedLabel={t('common.offline')} retryLabel={t('common.retry')} removeLabel={t('common.cancel')}
                onRemove={() => setPhotos((prev) => prev.filter((x) => x.key !== p.key))}
                onRetry={() => setPhotos((prev) => prev.filter((x) => x.key !== p.key))} />
            ))}
            {photos.length < MAX_PHOTOS ? <AddMediaTile label={t('createListing.addPhoto')} onPress={pickSource} /> : null}
          </ScrollView>

          <View style={styles.descRow}>
            <View style={{ flex: 1 }}>
              <Input label={t('createListing.descLabel')} value={description} onChangeText={setDescription} multiline maxLength={500} />
            </View>
          </View>
          <VoiceButton label={voice.listening ? t('createListing.listening') : t('createListing.speak')} listening={voice.listening}
            onPress={() => (voice.listening ? voice.stop() : voice.start())} />
          {voice.error ? <Text style={styles.voiceErr}>{t('createListing.voiceFailed')}</Text> : null}

          <Input label={t('createListing.qtyLabel')} value={qty} onChangeText={setQty} keyboardType="number-pad" />
          <Input label={t('createListing.priceLabel')} value={rupees} onChangeText={setRupees} keyboardType="number-pad" error={error} />
        </>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  result: { paddingVertical: space[3] },
  resultName: { fontFamily: font.body, fontSize: font.size.lg, color: color.ink800 },
  picked: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space[4], borderRadius: radius.lg, backgroundColor: color.primary50, borderWidth: 1.5, borderColor: color.primary600 },
  pickedName: { fontFamily: font.body, fontSize: font.size.lg, fontWeight: font.weight.semibold, color: color.primary800 },
  change: { fontFamily: font.body, fontSize: font.size.sm, color: color.primary700 },
  section: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink600 },
  descRow: { flexDirection: 'row', gap: space[2] },
  voiceErr: { fontFamily: font.body, fontSize: font.size.sm, color: color.dangerDark },
});
