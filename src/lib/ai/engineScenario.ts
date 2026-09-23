import { DISTRICTS, MEASURES } from "@/domain";
import type { Decision, ReplacementCandidate, ScenarioResult, ValidScenarioResult } from "@/types/simulation";

const decisionKey = (decision: Decision) => `${decision.measureId}:${decision.districtId ?? ""}`;

/** Send the engine's original IDs, never reconstruct them from translated labels. */
export function decisionsFromAnalysis(scenario: ScenarioResult): Decision[] {
  return scenario.decisions.map((decision) => ({ ...decision }));
}

/** Compare two validated engine results. A replacement need not improve Score. */
export function toReplacementCandidate(
  decisions: readonly Decision[],
  current: ValidScenarioResult,
  replacementDecisions: readonly Decision[],
  replacement: ValidScenarioResult,
): ReplacementCandidate | null {
  const currentKeys = new Set(decisions.map(decisionKey));
  const replacementKeys = new Set(replacementDecisions.map(decisionKey));
  const removed = decisions.filter((decision) => !replacementKeys.has(decisionKey(decision)));
  const added = replacementDecisions.filter((decision) => !currentKeys.has(decisionKey(decision)));
  if (removed.length !== 1 || added.length !== 1 ||
    decisions.some((decision) => decision.measureId === added[0].measureId)) return null;

  const describe = (decision: Decision) => {
    const measure = MEASURES.find(({ id }) => id === decision.measureId)!;
    const district = DISTRICTS.find(({ id }) => id === decision.districtId);
    return {
      decision: { ...decision },
      measureName: measure.name,
      ...(district ? { districtName: district.name } : {}),
    };
  };
  return {
    key: replacementDecisions.map(decisionKey).sort().join("|"),
    decisions: replacementDecisions.map((decision) => ({ ...decision })),
    removed: describe(removed[0]),
    added: describe(added[0]),
    addedLagQuarters: MEASURES.find(({ id }) => id === added[0].measureId)!.lagQuarters,
    result: replacement,
    scoreGain: replacement.finalScore - current.finalScore,
    weakestDistrictGain: replacement.weakestDistrictScoreAfter - current.weakestDistrictScoreAfter,
    removedCriticalCount: current.criticalAfter - replacement.criticalAfter,
  };
}

/** AI and UI consume the same canonical contract; no second result projection. */
export function toAnalysisScenario(simulation: ValidScenarioResult): ValidScenarioResult {
  return simulation;
}
