import { z } from "zod";

/**
 * Intelligent workflow request schema
 */
export const IntelligentWorkflowRequestSchema = z.object({
  userInput: z.string().min(1, "User input is required"),
});

export type IntelligentWorkflowRequest = z.infer<
  typeof IntelligentWorkflowRequestSchema
>;
