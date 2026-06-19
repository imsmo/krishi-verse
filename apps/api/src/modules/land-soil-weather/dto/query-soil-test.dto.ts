// modules/land-soil-weather/dto/query-soil-test.dto.ts · zod .strict() soil test list query (by parcel).
import { z } from 'zod';
export const QuerySoilTestsSchema = z.object({ parcelId: z.string().uuid() }).strict();
export type QuerySoilTestsDto = z.infer<typeof QuerySoilTestsSchema>;
