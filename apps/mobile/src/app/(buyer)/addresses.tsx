// apps/mobile/src/app/(buyer)/addresses.tsx · screens 129/134 (delivery address book). Thin screen (guide §3):
// list the buyer's saved addresses, add a new one (inline form), delete. Used by checkout to pick a delivery
// address. Behind `buyer_checkout`. Contact name/phone are PII (server-held, shown only to the owner). Validation
// is client-side for UX; the server re-validates (zod .strict). Degrade-never-die.
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { Address } from '@krishi-verse/sdk-js';
import { Button, Card, Input, EmptyState, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { listAddresses, createAddress, deleteAddress } from '../../features/addresses/addresses.api';
import { formatAddress } from '../../features/cart/cart-math';

export default function Addresses() {
  const { t } = useTranslation();
  const enabled = useFlag('buyer_checkout');
  const [items, setItems] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [line1, setLine1] = useState('');
  const [pincode, setPincode] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const load = useCallback(async () => { setItems(await listAddresses()); setLoading(false); }, []);
  useFocusEffect(useCallback(() => { if (enabled) { setLoading(true); load(); } }, [enabled, load]));

  if (!enabled) return <ScreenScaffold title={t('address.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const onSave = async () => {
    if (line1.trim().length < 3) { setError(t('address.line1Required')); return; }
    setBusy(true); setError(undefined);
    try {
      await createAddress({ line1: line1.trim(), pincode: pincode.trim() || undefined, contactPhone: contactPhone.trim() || undefined, isDefault: items.length === 0 });
      setLine1(''); setPincode(''); setContactPhone(''); setAdding(false);
      await load();
    } catch { setError(t('address.saveFailed')); }
    finally { setBusy(false); }
  };
  const onDelete = async (id: string) => { try { await deleteAddress(id); } catch { /* degrade */ } await load(); };

  return (
    <ScreenScaffold
      title={t('address.title')}
      footer={!adding ? <Button title={t('address.add')} onPress={() => setAdding(true)} /> : <Button title={t('address.save')} onPress={onSave} loading={busy} disabled={line1.trim().length < 3} />}
    >
      {adding ? (
        <Card>
          <Input label={t('address.line1')} value={line1} onChangeText={setLine1} autoFocus error={error} />
          <Input label={t('address.pincode')} value={pincode} onChangeText={setPincode} keyboardType="number-pad" maxLength={10} />
          <Input label={t('address.contactPhone')} value={contactPhone} onChangeText={setContactPhone} keyboardType="phone-pad" maxLength={20} />
          <Pressable onPress={() => { setAdding(false); setError(undefined); }} style={{ marginTop: space[3] }} accessibilityRole="button"><Text style={styles.cancel}>{t('common.cancel')}</Text></Pressable>
        </Card>
      ) : loading ? <SkeletonCard lines={3} /> : (
        <FlatList
          data={items}
          keyExtractor={(a) => a.id}
          ItemSeparatorComponent={() => <View style={{ height: space[2] }} />}
          ListEmptyComponent={<EmptyState title={t('address.empty.title')} message={t('address.empty.message')} />}
          renderItem={({ item }) => (
            <Card>
              <Text style={styles.addr}>{formatAddress(item)}</Text>
              {item.isDefault ? <Text style={styles.default}>{t('address.default')}</Text> : null}
              <Pressable onPress={() => onDelete(item.id)} hitSlop={8} accessibilityRole="button"><Text style={styles.remove}>{t('address.delete')}</Text></Pressable>
            </Card>
          )}
        />
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  addr: { fontFamily: font.body, fontSize: font.size.md, color: color.ink800 },
  default: { fontFamily: font.body, fontSize: font.size.xs, color: color.primary700, marginTop: space[1] },
  remove: { fontFamily: font.body, fontSize: font.size.sm, color: color.primary700, marginTop: space[2] },
  cancel: { fontFamily: font.body, fontSize: font.size.md, color: color.ink500, textAlign: 'center' },
});
