import { expect, it } from "vitest";

import { analyzeScenario } from "@/lib/ai/analyze";
import { toAnalysisScenario } from "@/lib/ai/engineScenario";
import {
  applyIndicatorEffects,
  DISTRICTS,
  evaluateIndicators,
  EXAMPLE_DECISIONS,
  simulateScenario,
} from "../../../engine/index.mjs";

// Opt-in: RUN_LIVE_AI=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run src/lib/ai/liveEvaluation.test.ts
it.skipIf(process.env.RUN_LIVE_AI !== "1")("explains a recalculated scenario on changed district data", async () => {
  const simulation = simulateScenario(EXAMPLE_DECISIONS);
  expect(simulation.valid).toBe(true);
  if (!simulation.valid) return;

  const changed = DISTRICTS.map((district) => ({
    id: district.id,
    indicators: {
      ...district.indicators,
      ...(district.id === "nura" ? { S1: 25, S2: 20 } : {}),
      ...(district.id === "saryarka" ? { E2: 28 } : {}),
      ...(district.id === "yesil" ? { T1: 35 } : {}),
    },
  }));
  const before = evaluateIndicators(changed);
  const after = evaluateIndicators(changed.map((district) => ({
    id: district.id,
    indicators: applyIndicatorEffects(district.indicators, [
      ...simulation.result.measureEffects
        .filter((measure) => measure.districtIds.includes(district.id))
        .map((measure) => measure.effects),
      ...simulation.result.synergies
        .filter((synergy) => synergy.districtId === district.id)
        .map((synergy) => synergy.effects),
    ]),
  })));

  const scenario = {
    ...toAnalysisScenario(simulation),
    baselineScore: before.score,
    finalScore: after.score,
    scoreDelta: after.score - before.score,
    criticalBefore: before.criticalCount,
    criticalAfter: after.criticalCount,
    districts: after.districts.map((district, index) => ({
      districtId: district.id,
      name: district.name,
      scoreBefore: before.districts[index].score,
      scoreAfter: district.score,
      scoreDelta: district.score - before.districts[index].score,
      indicatorsBefore: before.districts[index].indicators,
      indicatorsAfter: district.indicators,
    })),
  };

  expect(before.score).toBeCloseTo(48.91492, 5);
  expect(after.score).toBeCloseTo(50.90031, 5);
  expect(before.criticalCount).toBe(4);
  expect(after.criticalCount).toBe(4);
  expect(after.weakestDistrictIds).toEqual(["nura"]);

  const analysis = await analyzeScenario(scenario);
  console.log(JSON.stringify({
    datasetChanges: { nura: { S1: 25, S2: 20 }, saryarka: { E2: 28 }, yesil: { T1: 35 } },
    calculated: {
      baselineScore: before.score,
      finalScore: after.score,
      criticalBefore: before.criticalCount,
      criticalAfter: after.criticalCount,
      weakestDistrict: after.weakestDistrictIds,
    },
    analysis,
  }, null, 2));
  expect(analysis.source).toBe("openai");
  expect(JSON.stringify(analysis)).not.toMatch(/критических районов|Wait|JSON invalid/i);
}, 35_000);
