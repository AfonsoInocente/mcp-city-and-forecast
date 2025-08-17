import { z } from "zod";
import { ACTIONS } from "../consts/constants.ts";
import { CityLocationSchema } from "./base-schemas.ts";

/**
 * Action enum for intelligent decisor
 * Uses constants from constants.ts to avoid duplication
 */
export const ActionEnum = z.enum([
  ACTIONS.CONSULT_ZIP_CODE,
  ACTIONS.CONSULT_ZIP_CODE_AND_WEATHER,
  ACTIONS.CONSULT_WEATHER_DIRECT,
  ACTIONS.OUT_OF_SCOPE,
  ACTIONS.REQUEST_ZIP_CODE,
  ACTIONS.REQUEST_LOCATION,
  ACTIONS.MULTIPLE_CITIES,
  ACTIONS.CITY_NOT_FOUND,
]);

export type Action = z.infer<typeof ActionEnum>;

/**
 * Intelligent decisor response schema
 */
export const IntelligentDecisorResponseSchema = z.object({
  action: ActionEnum,
  extractedZipCode: z.string().optional(),
  extractedCity: z.string().optional(),
  justification: z.string(),
  friendlyMessage: z.string(),
  foundCities: z.array(CityLocationSchema).optional(), // reuse city location schema
});

export type IntelligentDecisorResponse = z.infer<
  typeof IntelligentDecisorResponseSchema
>;

/**
 * Intelligent workflow response schema
 */
export const IntelligentWorkflowResponseSchema = z.object({
  initialMessage: z.string(),
  executedAction: z.string(),
  finalMessage: z.string(),
  action: z.string(),
  zipCodeData: z.any().optional(),
  weatherData: z.any().optional(),
  citiesFound: z.array(CityLocationSchema).optional(),
});

export type IntelligentWorkflowResponse = z.infer<
  typeof IntelligentWorkflowResponseSchema
>;
