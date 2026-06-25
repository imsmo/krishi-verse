// modules/tenant-integrations/dto/connect-integration.dto.ts · zod .strict() DTO for connecting a provider.
// `credential` is the raw provider secret — it goes straight to the vault (SecretWriter) and is NEVER persisted in
// our DB nor logged. `config` is NON-SECRET settings only (e.g. a sandbox flag, an account label), bounded.
import { z } from 'zod';

export const ConnectIntegrationSchema = z.object({
  providerCode: z.string().trim().regex(/^[a-z][a-z0-9_]{1,59}$/),       // anchored, ReDoS-safe
  credential: z.string().min(1).max(8000),                               // raw secret → vault only
  config: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
}).strict();
export type ConnectIntegrationDto = z.infer<typeof ConnectIntegrationSchema>;
