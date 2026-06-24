'use server';
// apps/web-tenant/src/app/disputes/actions.ts · tenant disputes-moderation mutations (needs dispute.resolve,
// re-checked server-side — this is NOT god-mode: a tenant admin only acts within their own tenant). The only
// place the authed tenantClient() writes for the disputes path:
//   - reviewDisputeAction / escalateDisputeAction: take under review / escalate (transitions).
//   - resolveDisputeAction: resolve with a decision (resolutionType + optional amount, money float-free; refunds
//     move money SERVER-SIDE — the app never does, Law 11).
// The API re-checks the legal transition; an illegal/raced move (409) degrades to a message (Law 12). The SDK's
// dispute methods expose NO Idempotency-Key, so none is passed. 'use server' modules export ONLY async functions.
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { tenantClient } from '../../lib/api-client';
import { requireSession } from '../../lib/session';
import { buildResolve } from '../../features/disputes/manage';
import { SdkError } from '@krishi-verse/sdk-js';

function back(id: string, qs: string): never { redirect(`/disputes/${encodeURIComponent(id)}?${qs}`); }

async function transition(formData: FormData, kind: 'review' | 'escalate'): Promise<void> {
  await requireSession('/disputes');
  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/disputes');
  try {
    if (kind === 'review') await tenantClient().disputes.review(id);
    else await tenantClient().disputes.escalate(id);
  } catch (e) {
    back(id, `error=${e instanceof SdkError && e.status === 409 ? 'illegal' : kind}`);
  }
  revalidatePath(`/disputes/${id}`);
  revalidatePath('/disputes');
  back(id, `ok=${kind}`);
}

export async function reviewDisputeAction(formData: FormData): Promise<void> { return transition(formData, 'review'); }
export async function escalateDisputeAction(formData: FormData): Promise<void> { return transition(formData, 'escalate'); }

export async function resolveDisputeAction(formData: FormData): Promise<void> {
  await requireSession('/disputes');
  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/disputes');
  const built = buildResolve({
    resolutionType: String(formData.get('resolutionType') ?? ''),
    amountMajor: String(formData.get('amountMajor') ?? ''),
    note: String(formData.get('note') ?? ''),
  });
  if (!built.ok) back(id, `error=${built.error}`);
  try {
    await tenantClient().disputes.resolve(id, built.value);
  } catch (e) {
    back(id, `error=${e instanceof SdkError && e.status === 409 ? 'illegal' : 'resolve'}`);
  }
  revalidatePath(`/disputes/${id}`);
  revalidatePath('/disputes');
  back(id, 'ok=resolve');
}
