import { z } from "zod";

/**
 * ZIP code request schema with validation
 */
export const ZipCodeRequestSchema = z.object({
  zipcode: z.string().transform((val) => {
    const cleaned = val.replace(/\D/g, "");
    if (cleaned.length !== 8) {
      throw new Error("ZIP code must contain exactly 8 numeric digits");
    }
    return cleaned;
  }),
});

export type ZipCodeRequest = z.infer<typeof ZipCodeRequestSchema>;
