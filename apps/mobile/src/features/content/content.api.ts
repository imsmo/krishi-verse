// apps/mobile/src/features/content/content.api.ts · data layer for tips + crop-hub + AI-assistant + voice-search
// (P-20). Keeps screens thin (guide §3). Tips are curated learning resources (box=browse → APPROVED, server-
// enforced); reads go through the SWR cache so the library + crop hub are usable offline (DoD: "tips browsable
// offline"). Saved tips are DEVICE-LOCAL bookmarks in AsyncStorage, scoped per user (one account can't read
// another's) — there is NO server bookmark endpoint yet (flagged). The AI assistant calls an ASSUMED endpoint
// (POST ai/assistant/messages, idempotent) — no farmer AI endpoint is live, so askAssistant DEGRADES to an
// honest "unavailable" result and the screen NEVER fabricates an answer. Voice-search reuses on-device STT, then
// filters cached tips locally. Degrade-never-die throughout.
import type { LearningResource, ResourceKind, AssistantReply } from '@krishi-verse/sdk-js';
import { apiClient } from '../../core/api/client';
import { cache } from '../../core/offline/sqlite.db';
import { POLICY } from '../../core/offline/cache-policies';
import { asyncStorageKv as kv } from '../../core/offline/kv';
import { currentScope } from '../../core/offline/scope';
import { newId } from '../../core/util/ids';
import { searchResources, type TipSnapshot } from './content';

export interface TipsPage { items: LearningResource[]; nextCursor: string | null }
const TIPS_SCOPE = 'public'; // approved tips are the same catalogue for everyone (not user-private)

/** Browse approved tips (keyset), optionally by kind. Read-through SWR cache → instant + offline. Degrades. */
export async function listTips(params: { kind?: ResourceKind; cursor?: string } = {}): Promise<TipsPage> {
  try {
    const { value } = await cache.read<TipsPage>({
      scope: TIPS_SCOPE, ns: 'tips', parts: [params.kind ?? 'all', params.cursor ?? ''], policy: POLICY.shortList,
      fetcher: async () => { const p = await apiClient().resources.list({ kind: params.kind, cursor: params.cursor }); return { items: p.items, nextCursor: p.nextCursor }; },
    });
    return value;
  } catch { return { items: [], nextCursor: null }; }
}

/** A single tip by id. There's no get-by-id endpoint, so we read the (cached) list and find it. Null if absent. */
export async function getTip(id: string): Promise<LearningResource | null> {
  try { const { items } = await listTips(); return items.find((r) => r.id === id) ?? null; }
  catch { return null; }
}

/** Voice/text search over the (cached) approved tips — local, ReDoS-safe substring. Works offline. */
export async function searchTips(query: string): Promise<LearningResource[]> {
  const { items } = await listTips();
  return searchResources(items, query);
}

/** A presigned, time-bounded URL for a tip's media asset (only for a clean asset). Null on failure. */
export async function tipMediaUrl(mediaId: string): Promise<string | null> {
  try { return (await apiClient().media.downloadUrl(mediaId)).url; } catch { return null; }
}

// --- saved tips (device-local bookmarks; scoped per user) ---
const savedKey = () => `content.savedTips:${currentScope()}`;
export async function loadSavedTips(): Promise<TipSnapshot[]> {
  try { const raw = await kv.get(savedKey()); return raw ? (JSON.parse(raw) as TipSnapshot[]) : []; }
  catch { return []; }
}
export async function persistSavedTips(list: TipSnapshot[]): Promise<void> {
  try { await kv.set(savedKey(), JSON.stringify(list)); } catch { /* best-effort; degrade-never-die */ }
}

// --- AI assistant (assumed endpoint; degrade honestly) ---
export interface AssistantResult { ok: boolean; reply?: AssistantReply; reason?: 'unavailable' }
/** Ask the assistant. Idempotent (Law 3). Returns a single-shape result: on ANY failure (incl. the endpoint not
 * being live yet) → { ok:false, reason:'unavailable' } so the screen shows an honest message, never a fake reply. */
export async function askAssistant(input: { message: string; languageCode: string; sessionId?: string }): Promise<AssistantResult> {
  try { const reply = await apiClient().assistant.ask(input, newId()); return { ok: true, reply }; }
  catch { return { ok: false, reason: 'unavailable' }; }
}
