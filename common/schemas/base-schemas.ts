import { z } from "zod";

/**
 * Base weather condition schema
 */
export const BaseWeatherConditionSchema = z.object({
  condition: z.string(),
  minimum: z.number(),
  maximum: z.number(),
});

export type BaseWeatherCondition = z.infer<typeof BaseWeatherConditionSchema>;

/**
 * Location base schema
 */
export const LocationBaseSchema = z.object({
  state: z.string(),
  city: z.string(),
});

export type LocationBase = z.infer<typeof LocationBaseSchema>;

/**
 * City location schema
 */
export const CityLocationSchema = z.object({
  id: z.number(),
  name: z.string(),
  state: z.string(),
});

export type CityLocation = z.infer<typeof CityLocationSchema>;

/**
 * Message base schema
 */
export const MessageBaseSchema = z.object({
  message: z.string(),
});

export type MessageBase = z.infer<typeof MessageBaseSchema>;

/**
 * Analysis base schema
 */
export const AnalysisBaseSchema = z.object({
  locationSummary: z.string(),
  climateCharacteristics: z.string(),
  recommendations: z.array(z.string()),
  curiosities: z.array(z.string()),
  alerts: z.array(z.string()).optional(),
});

export type AnalysisBase = z.infer<typeof AnalysisBaseSchema>;

/**
 * Insights base schema
 */
export const InsightsBaseSchema = z.object({
  climateType: z.string(),
  uvIntensity: z.string(),
  temperatureVariation: z.string(),
  estimatedAirQuality: z.string(),
});

export type InsightsBase = z.infer<typeof InsightsBaseSchema>;
