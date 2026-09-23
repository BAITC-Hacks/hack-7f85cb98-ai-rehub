import { describe, expect, it } from "vitest";

import {
  currentScenarioFixture,
  replacementCandidateFixture,
} from "@/lib/ai/__fixtures__/scenarioFixtures";
import { createFallbackAnalysis } from "@/lib/ai/fallbackAnalysis";

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
});

