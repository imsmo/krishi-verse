// modules/listings/repositories/price-history.repository.ts · append-only writes.
import { Injectable } from '@nestjs/common';
import { TxContext } from '../../../core/database/unit-of-work';
import { PriceHistory } from '../domain/price-history.entity';
import { uuidv7 } from '../../../core/database/uuid.util';

@Injectable()
export class PriceHistoryRepository {
  async append(tx: TxContext, h: PriceHistory): Promise<void> {
    const p = h.props;
    await tx.query(
      `INSERT INTO listing_price_history (id, listing_id, tenant_id, old_price_minor, new_price_minor, changed_by)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [uuidv7(), p.listingId, p.tenantId, p.oldPriceMinor?.toString() ?? null, p.newPriceMinor.toString(), p.changedBy],
    );
  }
}
