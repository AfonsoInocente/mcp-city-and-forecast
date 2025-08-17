import { z } from "zod";

/**
 * Weather forecast request schema
 */
export const WeatherForecastRequestSchema = z.object({
  cityCode: z.number().min(1, "Código da cidade deve ser um número positivo"),
});

export type WeatherForecastRequest = z.infer<
  typeof WeatherForecastRequestSchema
>;
