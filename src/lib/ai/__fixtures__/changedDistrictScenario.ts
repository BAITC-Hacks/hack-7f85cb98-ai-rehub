import { toAnalysisScenario } from "@/lib/ai/engineScenario";
import {
  applyIndicatorEffects,
  DISTRICTS,
  evaluateIndicators,
  EXAMPLE_DECISIONS,
  simulateScenario,
} from "../../../../engine/index.mjs";

// A separate evaluation dataset. The canonical district data stays unchanged.
export function changedDistrictScenario() {
  const simulation = simulateScenario(EXAMPLE_DECISIONS);
  if (!simulation.valid) throw new Error("Официальный сценарий должен быть допустимым");

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

  return {
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
}
