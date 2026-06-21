// apps/mobile/src/app/(farmer)/wallet/transactions.tsx · screen 21 (transactions). Thin screen (guide §3): the
// caller's payment history (money-in), keyset-paged via features/wallet + TxnList. Tap a row → txn-detail.
// Behind the `wallet` flag (kill-switch). Degrade-never-die: a failed read → friendly empty state, never a crash.
import React from 'react';
import { useRouter } from 'expo-router';
import { EmptyState, ScreenScaffold } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { listPayments } from '../../../features/wallet/wallet.api';
import { presentPayment, statusLabelKey, txnTitleKey } from '../../../features/wallet/txn';
import { TxnList } from '../../../features/wallet/components/TxnList';

export default function Transactions() {
  const { t, lang } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('wallet');

  if (!enabled) return <ScreenScaffold title={t('wallet.transactions')}><EmptyState title={t('wallet.unavailable')} /></ScreenScaffold>;

  return (
    <ScreenScaffold title={t('wallet.transactions')} scroll={false}>
      <TxnList
        fetchPage={listPayments}
        present={presentPayment}
        titleFor={(v) => t(`wallet.txnTitle.${txnTitleKey(v)}`)}
        statusFor={(v) => t(`wallet.status.${statusLabelKey(v.status)}`)}
        onOpen={(v) => router.push({ pathname: '/(farmer)/wallet/txn-detail', params: { id: v.id, kind: v.kind } })}
        langCode={lang}
        emptyTitle={t('wallet.txnEmpty.title')}
        emptyMessage={t('wallet.txnEmpty.message')}
      />
    </ScreenScaffold>
  );
}
