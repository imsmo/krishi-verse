// apps/admin-api/src/modules/global-catalogue-ops/domain/text.ts · shared plain-text guard for catalogue display
// names. Names are PLAIN TEXT — `<`/`>` are rejected (no HTML) and control chars stripped-by-rejection, so a
// master-taxonomy label can never carry markup a downstream tenant/app renderer might execute (stored-XSS closed
// by construction, §4). Localised display text lives in `translations` (L3); this is only the default_name.
import { InvalidCatalogueInputError } from './catalogue.errors';

// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/;

/** Plain-text only: trim, reject empty / over-length / angle brackets / control chars. Returns the trimmed text. */
export function assertPlainText(value: string, field: string, max: number): string {
  const v = value.trim();
  if (!v) throw new InvalidCatalogueInputError(`${field} is required`);
  if (v.length > max) throw new InvalidCatalogueInputError(`${field} exceeds ${max} chars`);
  if (/[<>]/.test(v)) throw new InvalidCatalogueInputError(`${field} must be plain text (no HTML)`);
  if (CONTROL_RE.test(v)) throw new InvalidCatalogueInputError(`${field} contains control characters`);
  return v;
}
