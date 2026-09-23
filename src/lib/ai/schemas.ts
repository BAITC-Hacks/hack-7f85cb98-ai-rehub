import { z } from "zod";

export const analyzeRequestSchema = z.strictObject({
  decisions: z.unknown(),
  replacementDecisions: z.unknown().optional(),
});

export const modelAnalysisSchema = z.object({
  summary: z.string().trim().min(1).max(600),
  strengths: z.array(z.string().trim().min(1).max(350)).max(5),
  risks: z.array(z.string().trim().min(1).max(350)).max(5),
  tradeoffs: z.array(z.string().trim().min(1).max(350)).max(5),
  recommendations: z.array(z.string().trim().min(1).max(350)).min(1).max(5),
});

export const analysisResponseSchema = modelAnalysisSchema.extend({
  source: z.enum(["openai", "fallback"]),
});
