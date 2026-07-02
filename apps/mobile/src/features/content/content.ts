// apps/mobile/src/features/content/content.ts · PURE tips + crop-hub + AI-assistant + voice-search logic for P-20.
// No React/native (SDK/ui types are `import type` → erased) → unit-tested. The SERVER is the authority on which
// resources exist (box=browse returns only APPROVED) and on AI answers; these helpers only drive the UI: local
// text search (ReDoS-safe plain includes), kind grouping/labels, saved-tips set math, and assistant input
// validation. Saved tips are DEVICE-LOCAL bookmarks (no server endpoint yet — flagged); we keep tiny snapshots.
import type { PillTone } from '@krishi-verse/ui-native';
import type { LearningResource, ResourceKind } from '@krishi-verse/sdk-js';

/** The resource kinds we surface, in display order (a "category" is a kind — there's no topic-name endpoint). */
export const RESOURCE_KINDS: ResourceKind[] = ['article', 'video', 'blog', 'post', 'audio'];

/** i18n key for a kind label (falls back to the raw kind if unknown). */
export function kindLabelKey(kind: string): string {
  return RESOURCE_KINDS.includes(kind as ResourceKind) ? `content.kind.${kind}` : 'content.kind.other';
}
/** A subtle tone per kind for the category chip / pill. */
export function kindTone(kind: string): PillTone {
  switch (kind) {
    case 'video': return 'info';
    case 'audio': return 'accent';
    case 'article': case 'blog': return 'success';
    default: return 'neutral';
  }
}

/** The design's topic-category chips (screen 55). Only 'all' is satisfiable today — the resource read-model
 * carries a topicId (uuid) but NO topic NAME/slug, so the named categories await a topic taxonomy (§13). Pure. */
export const TIP_CATEGORIES = ['all', 'crops', 'pest', 'soil', 'market'] as const;
export type TipCategory = (typeof TIP_CATEGORIES)[number];

/** Estimated read time (minutes, ≥1) from a tip body at `wpm` words/minute — DERIVED from the real body text, not
 * a fabricated field. Empty/whitespace body → 1. Pure. */
export function readTimeMinutes(body: string | null | undefined, wpm = 200): number {
  const words = (body ?? '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / wpm));
}

/** i18n key suffix for a resource's languageCode → `content.lang.<key>`. Unknown/empty → 'other'. Pure. */
export function languageLabelKey(code: string | null | undefined): string {
  const c = (code ?? '').toLowerCase();
  return c === 'hi' || c === 'en' || c === 'gu' ? c : 'other';
}

/** Pick up to `max` "related" tips for the detail screen (screen 101). REAL resources from the cached catalogue —
 * never fabricated. Excludes the current tip; prefers the SAME kind first (closest match) then fills with others,
 * preserving catalogue order. There is no server "related" endpoint, so this is an honest local heuristic. Pure. */
export function relatedTips<T extends Pick<LearningResource, 'id' | 'kind'>>(all: T[], currentId: string, max = 3): T[] {
  const others = all.filter((r) => r.id !== currentId);
  const current = all.find((r) => r.id === currentId);
  const sameKind = current ? others.filter((r) => r.kind === current.kind) : [];
  const rest = others.filter((r) => !sameKind.includes(r));
  return [...sameKind, ...rest].slice(0, Math.max(0, max));
}

/** Normalize a free-text / spoken query: trim, collapse whitespace, lowercase, cap length (bounded; no ReDoS). */
export function normalizeQuery(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 120);
}

/** Does a resource match a query? Plain case-insensitive substring over title + body (no regex on user input).
 * An empty query matches everything (so the library shows all). Works on cached resources → offline search. */
export function matchesQuery(r: Pick<LearningResource, 'title' | 'body'>, query: string): boolean {
  const q = normalizeQuery(query);
  if (!q) return true;
  const hay = `${r.title ?? ''} ${r.body ?? ''}`.toLowerCase();
  return hay.includes(q);
}

/** Filter a resource list by a query (pure; stable order preserved). */
export function searchResources<T extends Pick<LearningResource, 'title' | 'body'>>(items: T[], query: string): T[] {
  const q = normalizeQuery(query);
  if (!q) return items;
  return items.filter((r) => matchesQuery(r, q));
}

export interface KindSection<T> { kind: ResourceKind; items: T[] }
/** Group resources into ordered sections by kind (crop-hub). Empty kinds are dropped. */
export function groupByKind<T extends Pick<LearningResource, 'kind'>>(items: T[]): KindSection<T>[] {
  return RESOURCE_KINDS
    .map((kind) => ({ kind, items: items.filter((r) => r.kind === kind) }))
    .filter((s) => s.items.length > 0);
}

// --- saved tips (server-persisted via buyer/saves entityType='tip'; AsyncStorage mirror for offline render) ---
export interface TipSnapshot { id: string; title: string; kind: ResourceKind; savedAt: number }
/** Build a minimal snapshot to persist (so the saved screen renders offline without a fetch). */
export function tipSnapshot(r: Pick<LearningResource, 'id' | 'title' | 'kind'>, now: number = Date.now()): TipSnapshot {
  return { id: r.id, title: r.title, kind: r.kind, savedAt: now };
}
export function isSaved(saved: Pick<TipSnapshot, 'id'>[], id: string): boolean {
  return saved.some((s) => s.id === id);
}
/** Toggle a snapshot in the saved list (dedupe by id; newest first; capped). Pure. */
export function toggleSaved(saved: TipSnapshot[], snap: TipSnapshot, max = 300): TipSnapshot[] {
  const exists = saved.some((s) => s.id === snap.id);
  if (exists) return saved.filter((s) => s.id !== snap.id);
  return [snap, ...saved.filter((s) => s.id !== snap.id)].slice(0, max);
}
/** Reconcile the local snapshot mirror against the SERVER's authoritative set of saved tip ids (P1-16).
 *  The server owns WHICH tips are saved; the local mirror carries title/kind so the saved screen renders offline.
 *  Drops local snapshots the server no longer has; keeps a minimal placeholder for any server id missing locally
 *  (title resolves when its detail loads). Order: newest-first by the local savedAt, server-only ids appended.
 *  Pure — no I/O. */
export function reconcileSavedTips(local: TipSnapshot[], serverIds: string[], now: number = Date.now(), max = 300): TipSnapshot[] {
  const ids = new Set(serverIds);
  const byId = new Map(local.map((s) => [s.id, s]));
  const kept = local.filter((s) => ids.has(s.id));                       // drop locals the server dropped
  const missing = serverIds.filter((id) => !byId.has(id)).map((id): TipSnapshot => ({ id, title: id, kind: 'article', savedAt: now }));
  return [...kept, ...missing].sort((a, b) => b.savedAt - a.savedAt).slice(0, max);
}

// --- AI assistant input ---
export type AssistantLang = 'hi' | 'en' | 'gu';
export interface AssistantDraft { ok: boolean; input?: { message: string; languageCode: AssistantLang; sessionId?: string }; reason?: 'empty' | 'lang' }
/** Validate + assemble an assistant message payload. Empty/whitespace is rejected; lang must be a launch language
 * (the server re-validates). Trims + caps the message length (bounded request). */
export function buildAssistantDraft(form: { text?: string; lang?: string; sessionId?: string | null }): AssistantDraft {
  const message = (form.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 2000);
  if (!message) return { ok: false, reason: 'empty' };
  if (form.lang !== 'hi' && form.lang !== 'en' && form.lang !== 'gu') return { ok: false, reason: 'lang' };
  return { ok: true, input: { message, languageCode: form.lang, sessionId: form.sessionId ?? undefined } };
}

export type ChatRole = 'user' | 'assistant';
/** A transcript turn. `citations` are the SERVER's source links on an assistant turn (rendered verbatim — the app
 * never fabricates a source); absent on user turns. */
export interface ChatTurn { id: string; role: ChatRole; text: string; at: number; citations?: Array<{ title: string; url?: string }> }
/** Append a turn to a transcript (immutable). Bounds the in-memory transcript (perf §5). */
export function appendTurn(turns: ChatTurn[], turn: ChatTurn, max = 200): ChatTurn[] {
  return [...turns, turn].slice(-max);
}
