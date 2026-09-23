import { describe, expect, it } from "vitest";

import { decisionsFromAnalysis, toAnalysisScenario, toReplacementCandidate } from "@/lib/ai/engineScenario";
import { EXAMPLE_DECISIONS, INDICATORS, simulateScenario } from "../../../engine/index.mjs";

describe("engine to AI contract", () => {
  it("preserves every calculated district indicator and budget value", () => {
    const simulation = simulateScenario(EXAMPLE_DECISIONS);
    expect(simulation.valid).toBe(true);
    if (!simulation.valid) return;

    const scenario = toAnalysisScenario(simulation);
    expect(scenario.totalCost).toBe(95);
    expect(scenario.remainingBudget).toBe(5);
    expect(scenario.baselineScore).toBe(52.55768);
    expect(scenario.finalScore).toBe(56.54307);
    expect(scenario.criticalBefore).toBe(2);
    expect(scenario.criticalAfter).toBe(0);
    expect(decisionsFromAnalysis(scenario)).toEqual(expect.arrayContaining([...EXAMPLE_DECISIONS]));

    for (const district of scenario.districts) {
      const calculated = simulation.result.districtChanges.find(({ districtId }) => districtId === district.districtId);
      expect(calculated).toBeDefined();
      expect(district.scoreAfter).toBe(calculated?.scoreAfter);
      for (const { id } of INDICATORS) {
        expect(district.indicatorsBefore[id]).toBe(calculated?.indicators[id].before);
        expect(district.indicatorsAfter[id]).toBe(calculated?.indicators[id].after);
      }
    }
  });

  it("derives replacement gains from two engine runs", () => {
    const current = simulateScenario(EXAMPLE_DECISIONS);
    const replacementDecisions = [
      ...EXAMPLE_DECISIONS.filter(({ measureId }) => measureId !== "M5"),
      { measureId: "M3" as const, districtId: "nura" as const },
    ];
    const replacement = simulateScenario(replacementDecisions);
    expect(current.valid && replacement.valid).toBe(true);
    if (!current.valid || !replacement.valid) return;

    const candidate = toReplacementCandidate(EXAMPLE_DECISIONS, current, replacementDecisions, replacement);
    expect(candidate?.scoreGain).toBeCloseTo(0.66249, 5);
    expect(candidate?.weakestDistrictGain).toBeCloseTo(2.02, 5);
    expect(candidate?.removedCriticalCount).toBe(0);
    expect(candidate?.result.finalScore).toBe(57.20556);
  });
});
