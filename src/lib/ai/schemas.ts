import { z } from "zod";

const finite = z.number().finite();
const label = z.string().trim().min(1).max(240);
const indicators = z.object({
  T1: finite, T2: finite, E1: finite, E2: finite, S1: finite,
  S2: finite, B1: finite, B2: finite, C1: finite, C2: finite,
});
const decision = z.object({ measureId: label, districtId: label.optional() });
const district = z.object({
  districtId: label,
  name: label,
  scoreBefore: finite,
  scoreAfter: finite,
  scoreDelta: finite,
  indicatorsBefore: indicators,
  indicatorsAfter: indicators,
});
const contribution = z.object({
  measureId: label,
  measureName: label,
  districtName: label.optional(),
  affectedIndicators: z.array(z.enum(["T1", "T2", "E1", "E2", "S1", "S2", "B1", "B2", "C1", "C2"])).max(10),
});
const scenario = z.object({
  valid: z.boolean(),
  errors: z.array(label).max(20),
  totalCost: finite,
  remainingBudget: finite,
  baselineScore: finite,
  finalScore: finite,
  scoreDelta: finite,
  criticalBefore: finite,
  criticalAfter: finite,
  districts: z.array(district).max(30),
  contributions: z.array(contribution).max(30),
  activatedSynergies: z.array(label).max(30),
});
const change = z.object({
  decision,
  measureName: label,
  districtName: label.optional(),
});

export const analyzeRequestSchema = z.object({
  scenario,
  candidate: z.object({
    removed: change,
    added: change,
    result: scenario,
    scoreGain: finite,
    weakestDistrictGain: finite,
    removedCriticalCount: finite,
  }).optional(),
});

export const modelAnalysisSchema = z.object({
  summary: z.string().trim().min(1).max(600),
  strengths: z.array(z.string().trim().min(1).max(350)).max(5),
  risks: z.array(z.string().trim().min(1).max(350)).max(5),
  tradeoffs: z.array(z.string().trim().min(1).max(350)).max(5),
  recommendations: z.array(z.string().trim().min(1).max(350)).min(1).max(5),
});
