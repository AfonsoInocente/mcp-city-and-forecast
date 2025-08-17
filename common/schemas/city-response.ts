import { z } from "zod";
import { CityLocationSchema } from "./base-schemas.ts";

/**
 * City search response schema
 */
export const CitySearchResponseSchema = z.object({
  locations: z.array(CityLocationSchema),
});

export type CitySearchResponse = z.infer<typeof CitySearchResponseSchema>;
