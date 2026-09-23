import { DISTRICTS, MEASURES } from "./data.js";
import { calculateScenario, validatePlan } from "./engine.js";

/**
 * TEMPORARY INTEGRATION ADAPTER.
 * Replace this module with the shared engine's findBestReplacement function.
 * The UI contract is documented in HANDOFF.md.
 */
export function findBestReplacementMock(decisions) {
  const current = calculateScenario(decisions);
  const selectedIds = new Set(decisions.map((decision) => decision.measureId));
  let best = null;

  decisions.forEach((removedDecision, slotIndex) => {
    MEASURES.filter((measure) => !selectedIds.has(measure.id)).forEach((addedMeasure) => {
      const districtOptions = addedMeasure.type === "city"
        ? [null]
        : DISTRICTS.map((district) => district.id);

      districtOptions.forEach((districtId) => {
        const candidateDecisions = decisions.map((decision, index) => index === slotIndex
          ? { measureId: addedMeasure.id, districtId }
          : { ...decision });
        if (!validatePlan(candidateDecisions).valid) return;

        const candidate = calculateScenario(candidateDecisions);
        if (!best || candidate.score > best.candidate.score) {
          best = {
            current,
            candidate,
            decisions: candidateDecisions,
            replacement: {
              slotIndex,
              removed: current.decisions[slotIndex],
              added: candidate.decisions[slotIndex]
            }
          };
        }
      });
    });
  });

  if (!best) return null;

  const districtChanges = current.districts.map((district) => {
    const updated = best.candidate.districts.find((item) => item.id === district.id);
    return { id: district.id, name: district.name, delta: updated.afterScore - district.afterScore };
  }).sort((a, b) => b.delta - a.delta);
  const winner = districtChanges[0];
  const loser = [...districtChanges].sort((a, b) => a.delta - b.delta)[0];

  return {
    ...best,
    scoreGain: best.candidate.score - current.score,
    winner,
    compromise: loser.delta < 0
      ? { kind: "district", district: loser.name, delta: loser.delta }
      : best.candidate.totalCost > current.totalCost
        ? { kind: "budget", delta: best.candidate.totalCost - current.totalCost }
        : { kind: "focus", direction: best.replacement.added.measure.direction }
  };
}
