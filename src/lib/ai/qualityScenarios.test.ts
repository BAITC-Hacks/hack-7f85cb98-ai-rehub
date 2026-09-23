import { describe, expect, it } from "vitest";

import { changedDistrictScenario } from "@/lib/ai/__fixtures__/changedDistrictScenario";
import { replacementCandidateFixture } from "@/lib/ai/__fixtures__/scenarioFixtures";
import { toAnalysisScenario } from "@/lib/ai/engineScenario";
import { createFallbackAnalysis } from "@/lib/ai/fallbackAnalysis";
import { analysisResponseSchema } from "@/lib/ai/schemas";
import { EXAMPLE_DECISIONS, simulateScenario } from "../../../engine/index.mjs";

const cheapDecisions = [
  { measureId: "M9", districtId: "nura" },
  { measureId: "M11", districtId: "nura" },
  { measureId: "M10", districtId: "nura" },
  { measureId: "M12" },
  { measureId: "M4", districtId: "saryarka" },
];
const synergyDecisions = [
  { measureId: "M1", districtId: "nura" },
  { measureId: "M2" },
  { measureId: "M5", districtId: "saryarka" },
  { measureId: "M6" },
  { measureId: "M9", districtId: "nura" },
];
const replacementDecisions = [
  ...EXAMPLE_DECISIONS.filter(({ measureId }) => measureId !== "M5"),
  { measureId: "M3", districtId: "nura" },
];

describe("analysis quality on real engine scenarios", () => {
  it.each([
    { name: "official", decisions: EXAMPLE_DECISIONS, cost: 95, score: 56.54307, critical: 0 },
    { name: "cheap with a decline", decisions: cheapDecisions, cost: 61, score: 55.343025, critical: 1 },
    { name: "two synergies", decisions: synergyDecisions, cost: 95, score: 55.531895, critical: 1 },
    { name: "one-decision replacement", decisions: replacementDecisions, cost: 100, score: 57.20556, critical: 0 },
  ])("$name", ({ decisions, cost, score, critical }) => {
    const simulation = simulateScenario(decisions);
    expect(simulation.valid).toBe(true);
    if (!simulation.valid) return;

    const scenario = toAnalysisScenario(simulation);
    const analysis = createFallbackAnalysis(scenario);
    expect(scenario.totalCost).toBe(cost);
    expect(scenario.finalScore).toBeCloseTo(score, 5);
    expect(scenario.criticalAfter).toBe(critical);
    expect(analysisResponseSchema.safeParse(analysis).success).toBe(true);
    expect(analysis.summary).toContain(new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(score));

    const countedCritical = scenario.districts.reduce((count, district) =>
      count + Object.values(district.indicatorsAfter).filter((value) => value < 40).length, 0);
    expect(countedCritical).toBe(scenario.criticalAfter);
    expect(analysis.risks.join(" ").includes("критические показатели")).toBe(critical > 0);
    const weakest = scenario.districts.reduce((a, b) => a.scoreAfter < b.scoreAfter ? a : b);
    expect(analysis.risks.join(" ")).toContain(weakest.name);
  });

  it("reports the traffic decline in the cheap scenario", () => {
    const simulation = simulateScenario(cheapDecisions);
    expect(simulation.valid).toBe(true);
    if (!simulation.valid) return;
    const analysis = createFallbackAnalysis(toAnalysisScenario(simulation));
    expect(analysis.risks.join(" ")).toContain("«разгрузка дорог» снизился");
  });

  it("recommends only the measured replacement", () => {
    const current = simulateScenario(EXAMPLE_DECISIONS);
    expect(current.valid).toBe(true);
    if (!current.valid) return;
    const analysis = createFallbackAnalysis(toAnalysisScenario(current), replacementCandidateFixture);
    expect(analysis.recommendations.join(" ")).toContain("M3");
    expect(analysis.recommendations.join(" ")).toContain("0,66");
  });

  it("identifies unresolved problems on a separate changed district dataset", () => {
    const scenario = changedDistrictScenario();
    const analysis = createFallbackAnalysis(scenario);
    expect(scenario.baselineScore).toBeCloseTo(48.91492, 5);
    expect(scenario.finalScore).toBeCloseTo(50.90031, 5);
    expect(scenario.criticalBefore).toBe(4);
    expect(scenario.criticalAfter).toBe(4);
    expect(analysisResponseSchema.safeParse(analysis).success).toBe(true);
    expect(analysis.risks.join(" ")).toContain("поликлиники");
    expect(analysis.risks.join(" ")).toContain("другие критические показатели: 1");
  });
});
