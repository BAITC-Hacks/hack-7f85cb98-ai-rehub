import { describe, expect, it } from "vitest";

import {
  currentScenarioFixture,
  replacementCandidateFixture,
} from "@/lib/ai/__fixtures__/scenarioFixtures";
import { createFallbackAnalysis } from "@/lib/ai/fallbackAnalysis";
import { toAnalysisScenario } from "@/lib/ai/engineScenario";
import { analysisResponseSchema } from "@/lib/ai/schemas";
import { simulateScenario } from "../../../engine/index.mjs";

describe("createFallbackAnalysis", () => {
  it("explains a valid scenario using only calculated facts", () => {
    const analysis = createFallbackAnalysis(currentScenarioFixture);

    expect(analysis.source).toBe("fallback");
    expect(analysis.summary).toContain("52,56");
    expect(analysis.summary).toContain("56,54");
    expect(analysis.strengths.join(" ")).toContain(
      "критических показателей сократилось с 2 до 0",
    );
    expect(analysis.risks.join(" ")).toContain("район Нура");
    expect(analysis.recommendations[0]).toContain("контрфактический поиск");
  });

  it("describes the best one-decision replacement", () => {
    const analysis = createFallbackAnalysis(
      currentScenarioFixture,
      replacementCandidateFixture,
    );

    expect(analysis.summary).toContain("M5");
    expect(analysis.summary).toContain("M3");
    expect(analysis.summary).toContain("57,21");
    expect(analysis.recommendations.join(" ")).toContain("0,66");
    expect(analysis.recommendations.join(" ")).toContain("2,02");
  });

  it("does not mutate the supplied engine results", () => {
    const before = JSON.stringify({
      currentScenarioFixture,
      replacementCandidateFixture,
    });

    createFallbackAnalysis(currentScenarioFixture, replacementCandidateFixture);

    expect(
      JSON.stringify({ currentScenarioFixture, replacementCandidateFixture }),
    ).toBe(before);
  });

  it("reports an indicator decline even when the total Score improves", () => {
    const simulation = simulateScenario([
      { measureId: "M9", districtId: "nura" },
      { measureId: "M11", districtId: "nura" },
      { measureId: "M10", districtId: "nura" },
      { measureId: "M12" },
      { measureId: "M4", districtId: "saryarka" },
    ]);
    expect(simulation.valid).toBe(true);
    if (!simulation.valid) return;

    const analysis = createFallbackAnalysis(toAnalysisScenario(simulation));
    expect(analysis.summary).toContain("55,34");
    expect(analysis.risks.join(" ")).toContain("показатель «разгрузка дорог» снизился с 55,00 до 53,25");
  });

  it.each([0, 100])("keeps the response valid when all indicators equal %i", (value) => {
    const scenario = {
      ...currentScenarioFixture,
      baselineScore: value,
      finalScore: value,
      scoreDelta: 0,
      criticalBefore: value === 0 ? 50 : 0,
      criticalAfter: value === 0 ? 50 : 0,
      districts: currentScenarioFixture.districts.map((district) => ({
        ...district,
        scoreBefore: value,
        scoreAfter: value,
        scoreDelta: 0,
        indicatorsBefore: Object.fromEntries(Object.keys(district.indicatorsBefore).map((code) => [code, value])) as typeof district.indicatorsBefore,
        indicatorsAfter: Object.fromEntries(Object.keys(district.indicatorsAfter).map((code) => [code, value])) as typeof district.indicatorsAfter,
      })),
    };
    const analysis = createFallbackAnalysis(scenario);
    expect(analysisResponseSchema.safeParse(analysis).success).toBe(true);
    expect(analysis.risks.join(" ").includes("критические показатели")).toBe(value === 0);
    if (value === 0) expect(analysis.risks.join(" ")).toContain("другие критические показатели: 47");
  });
});

