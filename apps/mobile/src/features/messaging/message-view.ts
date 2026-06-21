// apps/mobile/src/features/messaging/message-view.ts · PURE chat presenters (no React/native; SDK type is
// `import type` → erased) → unit-tested. Classifies a server message into a render model (mine vs theirs, text /
// image / voice) and validates a draft before send. Content is text or a media id (never raw bytes here).
import type { Message } from '@krishi-verse/sdk-js';

export type MessageKind = 'text' | 'image' | 'voice' | 'empty';
export interface MessageView { id: string; mine: boolean; kind: MessageKind; body: string | null; mediaId: string | null; flagged: boolean; createdAt?: string; }

/** Map a server message + the viewer's userId → a presentational view. `kind` is derived from which field is set
 * (attachment ⇒ image, voice ⇒ voice, else text). */
export function presentMessage(m: Message, myUserId: string): MessageView {
  const kind: MessageKind = m.attachmentMediaId ? 'image' : m.voiceMediaId ? 'voice' : m.body ? 'text' : 'empty';
  return {
    id: m.id, mine: m.senderUserId === myUserId, kind, body: m.body,
    mediaId: m.attachmentMediaId ?? m.voiceMediaId ?? null, flagged: m.isFlagged, createdAt: m.createdAt,
  };
}

/** A draft is sendable if it has non-blank text OR a pending attachment. Prevents empty/whitespace sends. */
export function canSend(text: string, hasAttachment: boolean): boolean {
  return (text ?? '').trim().length > 0 || hasAttachment;
}

/** Trim + bound a text body to the server's max (4000) before sending. */
export function normalizeBody(text: string): string {
  return (text ?? '').trim().slice(0, 4000);
}
