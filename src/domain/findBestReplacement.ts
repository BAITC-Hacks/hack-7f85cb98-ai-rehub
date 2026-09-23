import { DISTRICTS } from '../data/districts.ts';
import { MEASURES } from '../data/measures.ts';
import { evaluateScenario } from './evaluateScenario.ts';
import { validateScenario } from './validateScenario.ts';
import type {
  AdvisorResult,
  Decision,
  DecisionChange,
  ReplacementCandidate,
} from '../types/simulation.ts';

const compareAscii = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const decisionKey = (decision: Decision): string =>
  `${decision.measureId}:${decision.districtId ?? ''}`;

const copyDecision = (decision: Decision): Decision =>
  decision.districtId === undefined
    ? { measureId: decision.measureId }
    : { measureId: decision.measureId, districtId: decision.districtId };

const canonicalDecisions = (decisions: readonly Decision[]): Decision[] =>
  decisions.map(copyDecision).sort((left, right) =>
    compareAscii(decisionKey(left), decisionKey(right)));

const scenarioKey = (decisions: readonly Decision[]): string =>
  decisions.map(decisionKey).sort(compareAscii).join('|');

const changeFor = (decision: Decision): DecisionChange => {
  const measure = MEASURES.find(item => item.id === decision.measureId);
  if (!measure) throw new Error(`Validated measure disappeared: ${decision.measureId}`);
  const district = decision.districtId === undefined
    ? undefined
    : DISTRICTS.find(item => item.id === decision.districtId);
  if (decision.districtId !== undefined && !district) {
    throw new Error(`Validated district disappeared: ${decision.districtId}`);
  }
  return {
    decision: copyDecision(decision),
    measureName: measure.name,
    ...(district ? { districtName: district.name } : {}),
  };
};

const byScore = (left: ReplacementCandidate, right: ReplacementCandidate): number =>
  right.result.finalScore - left.result.finalScore ||
  left.result.criticalAfter - right.result.criticalAfter ||
  compareAscii(left.key, right.key);

const byWeakestDistrict = (
  left: ReplacementCandidate,
  right: ReplacementCandidate,
): number =>
  right.weakestDistrictGain - left.weakestDistrictGain ||
  right.result.finalScore - left.result.finalScore ||
  compareAscii(left.key, right.key);

const byFastImpact = (left: ReplacementCandidate, right: ReplacementCandidate): number =>
  left.addedLagQuarters - right.addedLagQuarters ||
  right.result.finalScore - left.result.finalScore ||
  compareAscii(left.key, right.key);

/** Exhaustive, deterministic search over one replacement of a valid five-decision scenario. */
export function findBestReplacement(current: unknown): AdvisorResult {
  const validation = validateScenario(current);
  const currentResult = evaluateScenario(current);
  if (!validation.valid || !currentResult.valid) {
    return {
      current: currentResult,
      topAlternatives: [],
      evaluatedCandidates: 0,
      validCandidates: 0,
    };
  }

  const original = canonicalDecisions(validation.decisions);
  const chosenMeasureIds = new Set(original.map(decision => decision.measureId));
  const seen = new Set<string>();
  const candidates: ReplacementCandidate[] = [];
  let evaluatedCandidates = 0;

  for (let removedIndex = 0; removedIndex < original.length; removedIndex += 1) {
    const removed = original[removedIndex]!;
    const kept = original.filter((_, index) => index !== removedIndex);
    for (const measure of MEASURES) {
      if (chosenMeasureIds.has(measure.id)) continue;
      const districtIds = measure.scope === 'city'
        ? [undefined]
        : DISTRICTS.map(district => district.id);
      for (const districtId of districtIds) {
        const added: Decision = districtId === undefined
          ? { measureId: measure.id }
          : { measureId: measure.id, districtId };
        const decisions = canonicalDecisions([...kept, added]);
        evaluatedCandidates += 1;
        if (!validateScenario(decisions).valid) continue;
        const result = evaluateScenario(decisions);
        if (!result.valid) continue;
        const key = scenarioKey(decisions);
        if (seen.has(key)) continue;
        seen.add(key);
        candidates.push({
          key,
          decisions,
          removed: changeFor(removed),
          added: changeFor(added),
          addedLagQuarters: measure.lagQuarters,
          result,
          scoreGain: result.finalScore - currentResult.finalScore,
          weakestDistrictGain:
            result.weakestDistrictScoreAfter - currentResult.weakestDistrictScoreAfter,
          removedCriticalCount: currentResult.criticalAfter - result.criticalAfter,
        });
      }
    }
  }

  const scoreOrder = [...candidates].sort(byScore);
  const weakestWinner = [...candidates].sort(byWeakestDistrict)[0];
  const fastestWinner = [...candidates].sort(byFastImpact)[0];
  const scoreWinner = scoreOrder[0];
  return {
    current: currentResult,
    topAlternatives: scoreOrder.slice(0, 3),
    evaluatedCandidates,
    validCandidates: candidates.length,
    ...(scoreWinner ? { bestByScore: scoreWinner } : {}),
    ...(weakestWinner ? { bestForWeakestDistrict: weakestWinner } : {}),
    ...(fastestWinner ? { bestFastImpact: fastestWinner } : {}),
  };
}
