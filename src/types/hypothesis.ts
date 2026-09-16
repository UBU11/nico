import { z } from "zod";

export const HypothesisOutputSchema = z.object({
  rootCause: z.string().min(1),
  explanation: z.string().min(1),
  affectedFiles: z.array(z.string()).default([]),
  patchDiff: z.string().min(1),
  confidenceScore: z.number().min(0).max(1),
  verificationCommand: z.string().default("bun test"),
});

export type HypothesisOutput = z.infer<typeof HypothesisOutputSchema>;
