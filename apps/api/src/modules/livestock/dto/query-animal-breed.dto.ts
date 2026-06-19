// modules/livestock/dto/query-animal-breed.dto.ts · zod .strict() breed browse query (by species).
import { z } from 'zod';
export const QueryBreedsSchema = z.object({ speciesId: z.string().uuid() }).strict();
export type QueryBreedsDto = z.infer<typeof QueryBreedsSchema>;
