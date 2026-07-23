// modules/listings/dto/add-listing-photo.dto.ts · KV-MF-14 (screen 112 "Add more photos" cta).
// Attach ONE already-uploaded, AV-clean image (core/media) to the caller's OWN, already-created listing.
import { z } from 'zod';

export const AddListingPhotoSchema = z.object({
  mediaAssetId: z.string().uuid(),
}).strict();
export type AddListingPhotoDto = z.infer<typeof AddListingPhotoSchema>;
