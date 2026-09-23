import { DISTRICTS } from "../../../engine/index.mjs";
import type { SimulationResult } from "../../../engine/index.mjs";

import type { IndicatorCode, Indicators, ScenarioResult } from "@/types/simulation";

const districtNames = new Map(DISTRICTS.map(({ id, name }) => [id, name]));

/** Adapt the engine's authoritative result to the small explanation contract. */
export function toAnalysisScenario(simulation: Extract<SimulationResult, { valid: true }>): ScenarioResult {
  const { budget } = simulation.validation;
  const { baseline, after, delta, districtChanges, measureEffects, synergies } = simulation.result;

  return {
    valid: true,
    errors: [],
    totalCost: budget.spent,
    remainingBudget: budget.remaining,
    baselineScore: baseline.score,
    finalScore: after.score,
    scoreDelta: delta.score,
    criticalBefore: baseline.criticalCount,
    criticalAfter: after.criticalCount,
    districts: districtChanges.map((district) => ({
      districtId: district.districtId,
      name: district.name,
      scoreBefore: district.scoreBefore,
      scoreAfter: district.scoreAfter,
      scoreDelta: district.scoreDelta,
      indicatorsBefore: Object.fromEntries(
        Object.entries(district.indicators).map(([code, change]) => [code, change.before]),
      ) as Indicators,
      indicatorsAfter: Object.fromEntries(
        Object.entries(district.indicators).map(([code, change]) => [code, change.after]),
      ) as Indicators,
    })),
    contributions: measureEffects.map((measure) => ({
      measureId: measure.measureId,
      measureName: measure.name,
      districtName: measure.scope === "district" ? districtNames.get(measure.districtIds[0]) : undefined,
      affectedIndicators: Object.keys(measure.effects) as IndicatorCode[],
    })),
    activatedSynergies: synergies.map((synergy) =>
      `${synergy.measureIds.join(" + ")} в районе ${districtNames.get(synergy.districtId)}`,
    ),
  };
}
