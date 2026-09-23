import { DISTRICTS, INDICATORS, EXAMPLE_DECISIONS, evaluateScenario } from "@/domain";
import { applyIndicatorEffects, evaluateIndicators } from "@/domain/indicatorMath";
import type { Decision, DistrictSnapshot, Indicators, ValidScenarioResult } from "@/types/simulation";

// Evaluation-only district snapshot. The production catalog stays unchanged.
// All arithmetic delegates to the same canonical functions used by evaluateScenario.
export function changedDistrictScenario(): ValidScenarioResult {
  const changed = DISTRICTS.map((district) => ({
    id: district.id,
    indicators: {
      ...district.indicators,
      ...(district.id === "nura" ? { S1: 25, S2: 20 } : {}),
      ...(district.id === "saryarka" ? { E2: 28 } : {}),
      ...(district.id === "yesil" ? { T1: 35 } : {}),
    },
  }));
  return evaluateFixtureSnapshot(EXAMPLE_DECISIONS, changed);
}

export function evaluateFixtureSnapshot(
  decisions: readonly Decision[],
  changed: readonly DistrictSnapshot[],
): ValidScenarioResult {
  const scenario = evaluateScenario(decisions);
  if (!scenario.valid) throw new Error("Тестовый сценарий должен быть допустимым");
  const before = evaluateIndicators(changed);
  const after = evaluateIndicators(changed.map((district) => ({
    id: district.id,
    indicators: applyIndicatorEffects(district.indicators, [
      ...scenario.contributions
        .filter((measure) => measure.targetDistrictIds.includes(district.id))
        .map((measure) => measure.realizedEffects),
      ...scenario.synergies
        .filter((synergy) => synergy.districtId === district.id)
        .map((synergy) => synergy.effects),
    ]),
  })));
  const districts = after.districts.map((district, index) => ({
    districtId: district.districtId,
    name: district.name,
    populationShare: district.populationShare,
    scoreBefore: before.districts[index].score,
    scoreAfter: district.score,
    scoreDelta: district.score - before.districts[index].score,
    indicatorsBefore: before.districts[index].indicators,
    indicatorsAfter: district.indicators,
    indicatorDeltas: Object.fromEntries(INDICATORS.map(({ id }) =>
      [id, district.indicators[id] - before.districts[index].indicators[id]])) as Indicators,
  }));
  return {
    ...scenario,
    baselineScore: before.score,
    finalScore: after.score,
    scoreDelta: after.score - before.score,
    criticalBefore: before.criticalCount,
    criticalAfter: after.criticalCount,
    cityAverageBefore: before.cityAverage,
    cityAverageAfter: after.cityAverage,
    weakestDistrictScoreBefore: before.weakestDistrictScore,
    weakestDistrictScoreAfter: after.weakestDistrictScore,
    weakestDistrictIds: after.weakestDistrictIds,
    criticalIndicatorsBefore: before.criticalIndicators,
    criticalIndicatorsAfter: after.criticalIndicators,
    scoreComponentsBefore: before.scoreComponents,
    scoreComponentsAfter: after.scoreComponents,
    districts,
    contributions: scenario.contributions.map((contribution) => ({
      ...contribution,
      observedDistrictDeltas: contribution.targetDistrictIds.map((districtId) => ({
        districtId,
        indicatorDeltas: Object.fromEntries(contribution.affectedIndicators.map((id) =>
          [id, districts.find((district) => district.districtId === districtId)!.indicatorDeltas[id]])),
      })),
    })),
  };
}
