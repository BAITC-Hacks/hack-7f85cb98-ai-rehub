import { z } from "zod";

export const analyzeRequestSchema = z.strictObject({
  decisions: z.unknown(),
  replacementDecisions: z.unknown().optional(),
});

export const modelPrioritiesSchema = z.strictObject({
  priorityIds: z.array(z.string()).max(8),
});

export const analysisResponseSchema = z.object({
  summary: z.string().trim().min(1).max(600),
  strengths: z.array(z.string().trim().min(1).max(350)).max(5),
  risks: z.array(z.string().trim().min(1).max(350)).max(5),
  tradeoffs: z.array(z.string().trim().min(1).max(350)).max(5),
  recommendations: z.array(z.string().trim().min(1).max(350)).min(1).max(5),
  source: z.enum(["openai", "fallback"]),
});
