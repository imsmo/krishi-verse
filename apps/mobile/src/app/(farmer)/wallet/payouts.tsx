// apps/mobile/src/app/(farmer)/wallet/payouts.tsx · screen 59 (payout history). Thin screen (guide §3): the
// caller's payouts (money-out / withdrawals), keyset-paged via features/wallet + TxnList. Tap → txn-detail.
// Behind the `wallet` flag. Degrade-never-die: a failed read → friendly empty state, never a crash.
import React from 'react';
import { useRouter } from 'expo-router';
import { EmptyState, ScreenScaffold } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { listPayouts } from '../../../features/wallet/wallet.api';
import { presentPayout, statusLabelKey, txnTitleKey } from '../../../features/wallet/txn';
import { TxnList } from '../../../features/wallet/components/TxnList';
import { useSecureScreen } from '../../../core/security';

export default function Payouts() {
  useSecureScreen(); // payout amounts on screen — FLAG_SECURE (§4)
  const { t, lang } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('wallet');

  if (!enabled) return <ScreenScaffold title={t('wallet.payouts')}><EmptyState title={t('wallet.unavailable')} /></ScreenScaffold>;

  return (
    <ScreenScaffold title={t('wallet.payouts')} scroll={false}>
      <TxnList
        fetchPage={listPayouts}
        present={presentPayout}
        titleFor={(v) => t(`wallet.txnTitle.${txnTitleKey(v)}`)}
        statusFor={(v) => t(`wallet.status.${statusLabelKey(v.status)}`)}
        onOpen={(v) => router.push({ pathname: '/(farmer)/wallet/txn-detail', params: { id: v.id, kind: v.kind } })}
        langCode={lang}
        emptyTitle={t('wallet.payoutEmpty.title')}
        emptyMessage={t('wallet.payoutEmpty.message')}
      />
    </ScreenScaffold>
  );
}
