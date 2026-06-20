// apps/mobile/src/core/offline/handlers.ts · side-effect barrel that ensures every offline-op replay handler is
// registered with the shared sync-queue BEFORE the first flush. Import this once at app boot. (Each feature
// self-registers on import; importing them here guarantees registration even if the owning screen hasn't loaded.)
import '../media/uploader';            // registers 'media.upload'
import '../../features/listings/listings.api'; // registers 'listing.create'
