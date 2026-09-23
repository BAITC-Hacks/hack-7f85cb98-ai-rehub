import { describe, expect, it } from "vitest";

import { changedDistrictScenario } from "@/lib/ai/__fixtures__/changedDistrictScenario";
import { currentScenarioFixture, replacementCandidateFixture } from "@/lib/ai/__fixtures__/scenarioFixtures";
import { analyzeScenario } from "@/lib/ai/analyze";
import { createFallbackAnalysis } from "@/lib/ai/fallbackAnalysis";
import { analysisResponseSchema } from "@/lib/ai/schemas";
import { findBestReplacement, SECOND_EXAMPLE_DECISIONS } from "@/domain";

// Opt-in: RUN_LIVE_AI=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run src/lib/ai/liveEvaluation.test.ts
// Exactly three provider calls; no retries. Run only with an explicitly authorized key.
describe.skipIf(process.env.RUN_LIVE_AI !== "1")("live provider audit", () => {
  const negative = findBestReplacement(SECOND_EXAMPLE_DECISIONS);
  if (!negative.current.valid || !negative.bestByScore) throw new Error("Expected valid negative candidate");
  const cases = [
    { name: "official", scenario: currentScenarioFixture, candidate: replacementCandidateFixture, score: 56.54307 },
    { name: "negative candidate", scenario: negative.current, candidate: negative.bestByScore, score: 57.236735 },
    { name: "changed district dataset", scenario: changedDistrictScenario(), candidate: undefined, score: 50.90031 },
  ];

  it.each(cases)("$name", async ({ name, scenario, candidate, score }) => {
    expect(scenario.finalScore).toBeCloseTo(score, 6);
    const verified = createFallbackAnalysis(scenario, candidate);
    const started = performance.now();
    const analysis = await analyzeScenario(scenario, candidate);
    const elapsedMs = Math.round(performance.now() - started);
    expect(analysisResponseSchema.safeParse(analysis).success).toBe(true);
    expect(analysis.summary).toBe(verified.summary);
    for (const section of ["strengths", "risks", "tradeoffs", "recommendations"] as const) {
      expect([...analysis[section]].sort()).toEqual([...verified[section]].sort());
    }
    if (name === "negative candidate") {
      expect(analysis.summary).toContain("снижает результат");
      expect(analysis.recommendations.join(" ")).toContain("Улучшение одной заменой не найдено");
    }
    if (name === "changed district dataset") {
      expect(scenario.baselineScore).toBeCloseTo(48.91492, 5);
      expect(scenario.criticalAfter).toBe(4);
      expect(analysis.risks.join(" ")).toContain("критические показатели");
    }
    console.log(JSON.stringify({
      name, model: process.env.OPENAI_MODEL || "gpt-6-sol", source: analysis.source,
      elapsedMs, schemaValid: true, allVerifiedFactsPreserved: true,
      baselineScore: scenario.baselineScore, finalScore: scenario.finalScore,
      criticalBefore: scenario.criticalBefore, criticalAfter: scenario.criticalAfter,
      candidateScoreGain: candidate?.scoreGain ?? null,
    }));
    expect(analysis.source).toBe("openai");
  }, 35_000);
});
