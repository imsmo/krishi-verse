// apps/mobile/src/features/onboarding/profile-setup.api.ts · data layer for screen 05 (Set Up Profile). Keeps the
// screen thin (guide §3). Executes the REAL writes the backend exposes today and is explicit about the gap:
//   • Full name (+ uploaded avatar) → PATCH /users/me (apiClient().users.updateMe) — PII-minimal, server-validated.
//   • UPI ID → POST /bank-accounts (a VPA is a public payment address, not a secret; its own vaultRef). Idempotent (Law 3).
//   • Photo → core/media uploadPickedImage (presign → PUT → confirm); if offline it queues and mediaId is null
//     (we simply omit photoMediaId — the farmer never loses the rest of the form).
//   • Village / Pincode / Farm Size / GPS → there is NO profile-write contract for these yet (updateMe is
//     PII-minimal; a land parcel needs more than onboarding collects). Rather than FAKE a server save, we persist
//     them locally (AsyncStorage, non-secret) so they are not lost and can be replayed when the API lands. FLAGGED.
// "Save Draft" persists the whole form locally; "Skip" writes nothing. The screen surfaces precise outcomes.
import type { PickedImage } from '../../core/media';
import { uploadPickedImage } from '../../core/media';
import { apiClient } from '../../core/api/client';
import { newId } from '../../core/util/ids';
import { asyncStorageKv } from '../../core/offline/kv';
import { buildSetupWrites, type ProfileSetupForm } from './profile-setup';

const DRAFT_KEY = 'onboarding:profile-setup:draft';
// FLAGGED gap: onboarding "extras" with no server profile-write contract yet (see header). Persisted locally only.
const EXTRAS_KEY = 'onboarding:profile-setup:extras';

export async function saveDraft(form: ProfileSetupForm): Promise<void> {
  try { await asyncStorageKv.set(DRAFT_KEY, JSON.stringify(form)); } catch { /* best-effort; never blocks the user */ }
}
export async function loadDraft(): Promise<ProfileSetupForm | null> {
  try { const raw = await asyncStorageKv.get(DRAFT_KEY); return raw ? (JSON.parse(raw) as ProfileSetupForm) : null; } catch { return null; }
}
export async function clearDraft(): Promise<void> {
  try { await asyncStorageKv.remove(DRAFT_KEY); } catch { /* ignore */ }
}

export type SubmitResult = 'ok' | 'invalid';

/** Run the real writes for "Save & Continue". Uploads the avatar (if picked), PATCHes the profile, adds the UPI
 * payout method, and persists the not-yet-server-backed extras locally. THROWS on a real server/network failure so
 * the screen can show the precise error; returns 'invalid' if client validation fails (the screen highlights the field). */
export async function submitProfileSetup(form: ProfileSetupForm, picked?: PickedImage | null): Promise<SubmitResult> {
  // 1) Upload avatar first so the patch can reference it. Offline → queued (mediaId null) → omit; rest still saves.
  let photoMediaId: string | undefined;
  if (picked) {
    const outcome = await uploadPickedImage(picked);
    if (outcome.mediaId) photoMediaId = outcome.mediaId;
  }

  const writes = buildSetupWrites({ ...form, photoMediaId: photoMediaId ?? form.photoMediaId ?? null });
  if (!writes.ok) return 'invalid';

  // 2) Profile (real). PATCH /users/me — name (+ photo). Throws on failure.
  await apiClient().users.updateMe(writes.profilePatch!);

  // 3) UPI payout method (real, idempotent). A VPA is a public address → it is its own vaultRef.
  if (writes.upiId) {
    await apiClient().bankAccounts.add(
      { accountKind: 'upi', upiId: writes.upiId, vaultRef: `upi:${writes.upiId}`, holderName: writes.profilePatch!.fullName, isPrimary: true },
      newId(),
    );
  }

  // 4) Extras with no server contract yet — persist locally (FLAGGED). Never faked as a server save.
  try { await asyncStorageKv.set(EXTRAS_KEY, JSON.stringify(writes.extras)); } catch { /* best-effort */ }

  await clearDraft();
  return 'ok';
}
