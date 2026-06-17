// core/media/media.domain.ts · pure media domain: object-key layout, type allow-lists, errors.
import { AppError, NotFoundError } from '../../shared/errors/app-error';

export type MediaKind = 'image' | 'video' | 'audio' | 'document';
export const MEDIA_KINDS: readonly MediaKind[] = ['image', 'video', 'audio', 'document'];

// Allow-list of MIME types per kind (reject anything else — no executables/HTML).
const ALLOWED: Record<MediaKind, readonly string[]> = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
  video: ['video/mp4', 'video/quicktime'],
  audio: ['audio/mpeg', 'audio/mp4', 'audio/ogg'],
  document: ['application/pdf'],
};
export function isMimeAllowed(kind: MediaKind, mime: string): boolean { return (ALLOWED[kind] ?? []).includes(mime); }
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg', 'application/pdf': 'pdf' };

/** Object key embeds tenant + kind + id so the scan webhook can resolve the owner from a signed key.
 *  Platform assets (tenantId null) use the 'p/' prefix. */
export function objectKey(tenantId: string | null, kind: MediaKind, mediaId: string, mime: string): string {
  const ext = EXT[mime] ?? 'bin';
  return tenantId ? `t/${tenantId}/${kind}/${mediaId}.${ext}` : `p/${kind}/${mediaId}.${ext}`;
}
/** Parse {tenantId, mediaId} back out of a key (used by the scan webhook). */
export function parseObjectKey(key: string): { tenantId: string | null; mediaId: string } | null {
  const t = key.match(/^t\/([0-9a-f-]{36})\/[a-z]+\/([0-9a-f-]{36})\.[a-z0-9]+$/i);
  if (t) return { tenantId: t[1], mediaId: t[2] };
  const p = key.match(/^p\/[a-z]+\/([0-9a-f-]{36})\.[a-z0-9]+$/i);
  if (p) return { tenantId: null, mediaId: p[1] };
  return null;
}

export class MediaNotFoundError extends NotFoundError { constructor() { super('Media not found'); } }
export class UnsupportedMediaTypeError extends AppError { constructor(mime: string) { super('MEDIA_TYPE_UNSUPPORTED', `Unsupported media type '${mime}'`, 415, { mime }); } }
export class MediaTooLargeError extends AppError { constructor(max: number) { super('MEDIA_TOO_LARGE', `File exceeds the ${max}-byte limit`, 413, { max }); } }
/** Download requested before the AV scan cleared the file — withhold until 'clean' (fail closed). */
export class MediaNotScannedError extends AppError { constructor(status: string) { super('MEDIA_NOT_CLEAN', `Media is not available (scan: ${status})`, 409, { status }); } }
export class ScanSignatureError extends AppError { constructor() { super('MEDIA_SCAN_BAD_SIGNATURE', 'Invalid scan-callback signature', 401); } }
