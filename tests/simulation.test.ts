import test from 'node:test';
import assert from 'node:assert/strict';
import {DISTRICTS} from '../src/data/districts.ts';
import {MEASURES} from '../src/data/measures.ts';
import {EXAMPLE_DECISIONS, SECOND_EXAMPLE_DECISIONS} from '../src/data/rules.ts';
import {validateScenario} from '../src/domain/validateScenario.ts';
import {evaluateScenario, getBaseline} from '../src/domain/evaluateScenario.ts';
import {findBestReplacement} from '../src/domain/findBestReplacement.ts';
import type {Decision, ValidScenarioResult} from '../src/types/simulation.ts';

const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const keyOf = (decisions: readonly Decision[]) => decisions.map(d => `${d.measureId}:${d.districtId ?? ''}`).sort().join('|');
const compareKeys = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
function requireValid(input: unknown): ValidScenarioResult {
  const result = evaluateScenario(input);
  assert.equal(result.valid, true, result.errors.join('; '));
  if (!result.valid) throw new Error('Invalid test fixture');
  return result;
}

test('integration: baseline and both captain examples use the real canonical modules', () => {
  const baseline = getBaseline();
  close(baseline.score, 52.55768);
  close(baseline.cityAverage, 56.8624);
  assert.equal(baseline.criticalCount, 2);
  for (const [decisions, cost, score, average] of [
    [EXAMPLE_DECISIONS, 95, 56.54307, 58.0776],
    [SECOND_EXAMPLE_DECISIONS, 98, 57.236735, 58.5848],
  ] as const) {
    assert.equal(validateScenario(decisions).valid, true);
    const result = requireValid(decisions);
    assert.equal(result.totalCost, cost);
    close(result.finalScore, score);
    close(result.cityAverageAfter, average);
    assert.equal(result.criticalAfter, 0);
    close(result.scoreDelta, score - baseline.score);
    assert.equal(JSON.stringify(result).includes('null'), false);
  }
});

test('integration: invalid submissions never receive scenario numbers or advisor winners', () => {
  for (const input of [null, [], EXAMPLE_DECISIONS.slice(1), [...EXAMPLE_DECISIONS, EXAMPLE_DECISIONS[0]],
    EXAMPLE_DECISIONS.map(d => d.measureId === 'M12' ? {...d, districtId: 'nura'} : d)]) {
    const result = evaluateScenario(input);
    assert.equal(result.valid, false);
    assert.equal(result.finalScore, null);
    assert.equal(result.scoreDelta, null);
    assert.ok(result.errors.length);
    const advisor = findBestReplacement(input);
    assert.equal(advisor.current.valid, false);
    assert.deepEqual(advisor.topAlternatives, []);
    assert.equal(advisor.bestByScore, undefined);
    assert.equal(advisor.bestForWeakestDistrict, undefined);
    assert.equal(advisor.bestFastImpact, undefined);
  }
});

// Independent test-only neighborhood enumerator. No production private generator or sorter.
function enumerate(current: readonly Decision[]) {
  const baseline = requireValid(current);
  const selected = new Set(current.map(d => d.measureId));
  let rawCount = 0;
  const candidates = new Map<string, {key: string; decisions: Decision[]; score: number; critical: number; weakestGain: number; lag: number}>();
  for (let slot = 0; slot < current.length; slot++) {
    for (const measure of MEASURES) {
      if (selected.has(measure.id)) continue;
      const additions: Decision[] = measure.scope === 'city' ? [{measureId: measure.id}]
        : DISTRICTS.map(d => ({measureId: measure.id, districtId: d.id}));
      for (const added of additions) {
        rawCount++;
        const decisions = current.map((old, i) => i === slot ? added : {...old});
        if (!validateScenario(decisions).valid) continue;
        const result = requireValid(decisions);
        const key = keyOf(decisions);
        candidates.set(key, {key, decisions, score: result.finalScore, critical: result.criticalAfter,
          weakestGain: result.weakestDistrictScoreAfter - baseline.weakestDistrictScoreAfter, lag: measure.lagQuarters});
      }
    }
  }
  return {baseline, rawCount, candidates: [...candidates.values()]};
}

for (const [label, decisions] of [
  ['first example', EXAMPLE_DECISIONS],
  ['second example', SECOND_EXAMPLE_DECISIONS],
  ['low-cost plan', [{measureId:'M9',districtId:'nura'}, {measureId:'M10',districtId:'almaty'},
    {measureId:'M11',districtId:'nura'}, {measureId:'M12'}, {measureId:'M4',districtId:'saryarka'}]],
] as const) {
  test(`integration: all advisor strategies match independent enumeration for ${label}`, () => {
    const original = structuredClone(decisions);
    const oracle = enumerate(decisions);
    const actual = findBestReplacement(decisions);
    assert.equal(actual.evaluatedCandidates, oracle.rawCount);
    assert.equal(actual.validCandidates, oracle.candidates.length);
    const byScore = [...oracle.candidates].sort((a,b) => b.score-a.score || a.critical-b.critical || compareKeys(a.key,b.key));
    const byWeakest = [...oracle.candidates].sort((a,b) => b.weakestGain-a.weakestGain || b.score-a.score || compareKeys(a.key,b.key));
    const byFast = [...oracle.candidates].sort((a,b) => a.lag-b.lag || b.score-a.score || compareKeys(a.key,b.key));
    assert.deepEqual(actual.topAlternatives.map(c => c.key), byScore.slice(0,3).map(c => c.key));
    assert.equal(actual.bestByScore?.key, byScore[0]?.key);
    assert.equal(actual.bestForWeakestDistrict?.key, byWeakest[0]?.key);
    assert.equal(actual.bestFastImpact?.key, byFast[0]?.key);
    const all = [...actual.topAlternatives, actual.bestByScore, actual.bestForWeakestDistrict, actual.bestFastImpact].filter(c => c !== undefined);
    for (const candidate of all) {
      assert.notEqual(candidate.key, keyOf(decisions));
      assert.equal(candidate.key, keyOf(candidate.decisions));
      assert.equal(decisions.filter(d => candidate.decisions.some(c => keyOf([d]) === keyOf([c]))).length, 4);
      assert.equal(decisions.some(d => d.measureId === candidate.added.decision.measureId), false);
      assert.deepEqual(candidate.result, requireValid(candidate.decisions));
      close(candidate.scoreGain, candidate.result.finalScore - oracle.baseline.finalScore);
      close(candidate.weakestDistrictGain, candidate.result.weakestDistrictScoreAfter - oracle.baseline.weakestDistrictScoreAfter);
      assert.equal(candidate.removedCriticalCount, oracle.baseline.criticalAfter - candidate.result.criticalAfter);
    }
    const reversed = findBestReplacement([...decisions].reverse());
    assert.deepEqual(actual.topAlternatives, reversed.topAlternatives);
    assert.deepEqual(decisions, original);
  });
}
