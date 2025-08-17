import { z } from "zod";
import {
  LocationBaseSchema,
  BaseWeatherConditionSchema,
} from "./base-schemas.ts";

/**
 * Extended weather condition schema for data analysis
 * Extends base weather condition with additional fields
 */
export const ExtendedWeatherConditionSchema = BaseWeatherConditionSchema.extend(
  {
    date: z.string(),
    conditionDescription: z.string(),
    uvIndex: z.number(),
  }
);

export type ExtendedWeatherCondition = z.infer<
  typeof ExtendedWeatherConditionSchema
>;

/**
 * Weather forecast response schema
 * Note: This schema keeps BrasilAPI response fields in Portuguese
 * but converts them to English for internal API communication
 */
export const WeatherForecastResponseSchema = z.object({
  ...LocationBaseSchema.shape, // reuse location base schema
  updatedAt: z.string(), // converted from 'atualizado_em'
  weather: z.array(ExtendedWeatherConditionSchema), // reuse extended weather condition
});

export type WeatherForecastResponse = z.infer<
  typeof WeatherForecastResponseSchema
>;
