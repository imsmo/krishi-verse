// core/media/image-processing.job.ts
// Worker job (runs in apps/worker as the BYPASSRLS kv_relay role): after the AV scan clears an
// uploaded image, claim it (FOR UPDATE SKIP LOCKED across tenants) and strip its EXIF/XMP metadata
// (privacy: removes embedded GPS). Bounded per tick; idempotent (the exif_stripped flag). A failure
// on one image is isolated and retried next tick — never crashes the worker.
import type { Pool } from 'pg';
import { TxContext } from '../database/unit-of-work';
import { MediaRepository } from './media.repository';
import { MediaService } from './media-links.service';

export class ImageProcessingJob {
  constructor(private readonly systemPool: Pool, private readonly repo: MediaRepository, private readonly media: MediaService) {}

  async run(limit = 50): Promise<{ claimed: number; processed: number; failed: number }> {
    const client = await this.systemPool.connect();
    let claimed: Array<{ id: string; tenantId: string | null }> = [];
    try {
      await client.query('BEGIN');
      const tx: TxContext = { query: (sql, params) => client.query(sql, params as any) as any, tenantId: '', userId: 'system' };
      claimed = await this.repo.claimUnstrippedImages(tx, limit);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw e;
    } finally {
      client.release();
    }

    let processed = 0, failed = 0;
    for (const c of claimed) {
      try { await this.media.processImage(c.tenantId ?? '', c.id); processed++; }
      catch { failed++; /* retried next tick (exif_stripped still false) */ }
    }
    return { claimed: claimed.length, processed, failed };
  }
}
