import { z } from "zod";

/**
 * City search request schema
 */
export const CitySearchRequestSchema = z.object({
  cityName: z
    .string()
    .min(2, "Nome da cidade deve ter pelo menos 2 caracteres"),
});

export type CitySearchRequest = z.infer<typeof CitySearchRequestSchema>;
