// modules/listings/repositories/listing-attribute.repository.ts
import { Injectable } from '@nestjs/common';
import { TxContext } from '../../../core/database/unit-of-work';
import { ListingAttribute } from '../domain/listing-attribute.entity';
import { uuidv7 } from '../../../core/database/uuid.util';

@Injectable()
export class ListingAttributeRepository {
  async upsertMany(tx: TxContext, attrs: ListingAttribute[]): Promise<void> {
    for (const a of attrs) {
      const v = a.props.value;
      await tx.query(
        `INSERT INTO listing_attribute_values
           (id, tenant_id, listing_id, attribute_id, value_text, value_number, value_bool, value_date, option_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (listing_id, attribute_id) DO UPDATE SET
           value_text=EXCLUDED.value_text, value_number=EXCLUDED.value_number,
           value_bool=EXCLUDED.value_bool, value_date=EXCLUDED.value_date, option_id=EXCLUDED.option_id`,
        [uuidv7(), a.props.tenantId, a.props.listingId, a.props.attributeId,
         v.kind === 'text' ? v.text : null, v.kind === 'number' ? v.number : null,
         v.kind === 'bool' ? v.bool : null, v.kind === 'date' ? v.date : null,
         v.kind === 'option' ? v.optionId : null],
      );
    }
  }
}
