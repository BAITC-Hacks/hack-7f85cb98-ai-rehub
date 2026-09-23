import { describe, expect, it } from "vitest";
import { decisionsFromAnalysis, toAnalysisScenario, toReplacementCandidate } from "@/lib/ai/engineScenario";
import { DISTRICTS, EXAMPLE_DECISIONS, SECOND_EXAMPLE_DECISIONS, findBestReplacement, evaluateScenario } from "@/domain";
import { evaluateFixtureSnapshot } from "@/lib/ai/__fixtures__/changedDistrictScenario";
import type { Indicators } from "@/types/simulation";
import { createFallbackAnalysis } from "@/lib/ai/fallbackAnalysis";
import { analysisResponseSchema } from "@/lib/ai/schemas";

describe("engine to AI contract", () => {
  it("preserves the canonical result and its original decision IDs", () => {
    const scenario = evaluateScenario(EXAMPLE_DECISIONS);
    expect(scenario.valid).toBe(true);
    if (!scenario.valid) return;
    expect(toAnalysisScenario(scenario)).toBe(scenario);
    expect(scenario.totalCost).toBe(95);
    expect(scenario.remainingBudget).toBe(5);
    expect(scenario.baselineScore).toBeCloseTo(52.55768, 8);
    expect(scenario.finalScore).toBeCloseTo(56.54307, 8);
    expect(scenario.criticalBefore).toBe(2);
    expect(scenario.criticalAfter).toBe(0);
    expect(decisionsFromAnalysis(scenario)).toEqual(expect.arrayContaining([...EXAMPLE_DECISIONS]));
  });

  it("derives the same signed gains and key as the canonical advisor", () => {
    for (const decisions of [EXAMPLE_DECISIONS, SECOND_EXAMPLE_DECISIONS]) {
      const advisor = findBestReplacement(decisions);
      expect(advisor.current.valid).toBe(true);
      if (!advisor.current.valid || !advisor.bestByScore) throw new Error("Expected valid advisor");
      const expected = advisor.bestByScore;
      const candidate = toReplacementCandidate(decisions, advisor.current, expected.decisions, expected.result);
      expect(candidate).toEqual(expected);
    }
  });

  it("accepts a negative replacement at the second example's local optimum", () => {
    const advisor = findBestReplacement(SECOND_EXAMPLE_DECISIONS);
    if (!advisor.current.valid || !advisor.bestByScore) throw new Error("Expected valid advisor");
    const expected = advisor.bestByScore;
    const candidate = toReplacementCandidate(SECOND_EXAMPLE_DECISIONS, advisor.current, expected.decisions, expected.result);
    expect(candidate?.scoreGain).toBeCloseTo(-0.01119, 8);
    expect(candidate?.result.finalScore).toBeCloseTo(57.225545, 8);
  });

  it("rejects a relocation of an already selected measure", () => {
    const current = evaluateScenario(EXAMPLE_DECISIONS);
    const decisions = EXAMPLE_DECISIONS.map((decision) => decision.measureId === "M5"
      ? { ...decision, districtId: "yesil" } : decision);
    const replacement = evaluateScenario(decisions);
    if (!current.valid || !replacement.valid) throw new Error("Expected valid selections");
    expect(toReplacementCandidate(EXAMPLE_DECISIONS, current, decisions, replacement)).toBeNull();
  });

  it("retains a zero gain when a changed dataset clips every positive effect", () => {
    const snapshot = DISTRICTS.map((district) => ({
      id: district.id,
      indicators: Object.fromEntries(Object.keys(district.indicators).map((id) => [id, 100])) as Indicators,
    }));
    const replacementDecisions = EXAMPLE_DECISIONS.map((decision) => decision.measureId === "M5"
      ? { measureId: "M3", districtId: "nura" } : decision);
    const current = evaluateFixtureSnapshot(EXAMPLE_DECISIONS, snapshot);
    const replacement = evaluateFixtureSnapshot(replacementDecisions, snapshot);
    const candidate = toReplacementCandidate(EXAMPLE_DECISIONS, current, replacementDecisions, replacement);
    expect(candidate?.scoreGain).toBe(0);
    expect(candidate?.weakestDistrictGain).toBe(0);
    expect(candidate?.removedCriticalCount).toBe(0);
    if (!candidate) throw new Error("Expected zero-gain candidate");
    const explanation = createFallbackAnalysis(current, candidate);
    expect(explanation.summary).toContain("не меняет результат");
    expect(explanation.recommendations[0]).toContain("без изменений");
    expect(analysisResponseSchema.safeParse(explanation).success).toBe(true);
  });

  it("retains newly created critical indicators as a negative signed difference", () => {
    const current = evaluateScenario(EXAMPLE_DECISIONS);
    const decisions = EXAMPLE_DECISIONS.map((decision) => decision.measureId === "M7"
      ? { measureId: "M9", districtId: "yesil" } : decision);
    const replacement = evaluateScenario(decisions);
    if (!current.valid || !replacement.valid) throw new Error("Expected valid selections");
    const candidate = toReplacementCandidate(EXAMPLE_DECISIONS, current, decisions, replacement);
    expect(candidate?.removedCriticalCount).toBeLessThan(0);
    expect(candidate?.removedCriticalCount).toBe(current.criticalAfter - replacement.criticalAfter);
  });
});
