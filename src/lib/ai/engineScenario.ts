import { DISTRICTS, MEASURES } from "../../../engine/index.mjs";
import type { Decision, SimulationResult } from "../../../engine/index.mjs";

import type { IndicatorCode, Indicators, ReplacementCandidate, ScenarioResult } from "@/types/simulation";

const districtNames = new Map(DISTRICTS.map(({ id, name }) => [id, name]));

/** Recover selection IDs from a locally calculated analysis for the server request. */
export function decisionsFromAnalysis(scenario: ScenarioResult): Decision[] {
  return scenario.contributions.map((contribution) => {
    const measure = MEASURES.find(({ id }) => id === contribution.measureId);
    if (!measure) throw new Error(`Неизвестная мера: ${contribution.measureId}`);
    if (measure.scope === "city") return { measureId: measure.id };
    const district = DISTRICTS.find(({ name }) => name === contribution.districtName);
    if (!district) throw new Error(`Неизвестный район: ${contribution.districtName}`);
    return { measureId: measure.id, districtId: district.id };
  });
}

/** Only an actual one-decision improvement may be described as a replacement. */
export function toReplacementCandidate(
  decisions: readonly Decision[],
  current: Extract<SimulationResult, { valid: true }>,
  replacementDecisions: readonly Decision[],
  replacement: Extract<SimulationResult, { valid: true }>,
): ReplacementCandidate | null {
  const key = (decision: Decision) => `${decision.measureId}:${decision.districtId ?? "city"}`;
  const currentKeys = new Set(decisions.map(key));
  const replacementKeys = new Set(replacementDecisions.map(key));
  const removed = decisions.filter((decision) => !replacementKeys.has(key(decision)));
  const added = replacementDecisions.filter((decision) => !currentKeys.has(key(decision)));
  const scoreGain = replacement.result.after.score - current.result.after.score;
  if (removed.length !== 1 || added.length !== 1 || scoreGain <= 0) return null;

  const describe = (decision: Decision) => {
    const measure = MEASURES.find(({ id }) => id === decision.measureId);
    if (!measure) throw new Error(`Неизвестная мера: ${decision.measureId}`);
    return {
      decision,
      measureName: measure.name,
      districtName: decision.districtId ? districtNames.get(decision.districtId) : undefined,
    };
  };
  const weakestDistrictId = current.result.after.weakestDistrictIds[0];
  const weakestAfter = replacement.result.after.districts.find(({ id }) => id === weakestDistrictId);
  if (!weakestAfter) return null;

  return {
    removed: describe(removed[0]),
    added: describe(added[0]),
    result: toAnalysisScenario(replacement),
    scoreGain,
    weakestDistrictGain: weakestAfter.score - current.result.after.weakestDistrictScore,
    removedCriticalCount: Math.max(0,
      current.result.after.criticalCount - replacement.result.after.criticalCount),
  };
}

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
