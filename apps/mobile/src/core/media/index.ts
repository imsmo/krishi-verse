// apps/mobile/src/core/media/index.ts · public surface for the media capture+upload core (P-01). Screens import
// from here only. Pipeline: pick (camera/gallery, JIT perms) → process (downscale/compress, EXIF dropped) →
// upload (presign → PUT with progress/retry → confirm), offline-first (enqueue + idempotent replay).
export type { PickedImage, ProcessedImage, UploadOutcome, ProgressFn, MediaKind } from './types';
export { captureFromCamera, pickFromGallery } from './picker';
export { processImage } from './process';
export { uploadProcessed, uploadPickedImage, MEDIA_UPLOAD_OP } from './uploader';
export { mediaKindForMime, isUploadableMime } from './mime';
