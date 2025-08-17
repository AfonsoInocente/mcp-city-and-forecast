import { z } from "zod";
import {
  LocationBaseSchema,
  BaseWeatherConditionSchema,
} from "./base-schemas.ts";

/**
 * Weather condition schema (alias for base)
 */
export const WeatherConditionSchema = BaseWeatherConditionSchema;
export type WeatherCondition = z.infer<typeof WeatherConditionSchema>;

/**
 * ZIP code response schema
 */
export const ZipCodeResponseSchema = z.object({
  zipcode: z.string(),
  ...LocationBaseSchema.shape, // reuse location base schema
  neighborhood: z.string(),
  street: z.string(),
  location_id: z.number().optional(),
  weather: z.array(WeatherConditionSchema).optional(),
});

export type ZipCodeResponse = z.infer<typeof ZipCodeResponseSchema>;
