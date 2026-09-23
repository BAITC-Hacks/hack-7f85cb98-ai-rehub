import test from 'node:test';
import assert from 'node:assert/strict';
import { DISTRICTS } from '../../src/data/districts.ts';
import { MEASURES } from '../../src/data/measures.ts';
import { EXAMPLE_DECISIONS, SECOND_EXAMPLE_DECISIONS } from '../../src/data/rules.ts';
import { evaluateScenario, getBaseline } from '../../src/domain/evaluateScenario.ts';
import {
  applyIndicatorEffects, calculateDistrictScore, clip,
  countCriticalIndicators, evaluateIndicators,
} from '../../src/domain/indicatorMath.ts';
import type { Decision, District, DistrictId, ScenarioResult } from '../../src/types/simulation.ts';

const close = (actual: number, expected: number) => assert.ok(
  Math.abs(actual - expected) <= 1e-8, `expected ${expected}, received ${actual}`,
);
const decision = (measureId: string, districtId?: string): Decision =>
  districtId === undefined ? { measureId } : { measureId, districtId };
const valid = (input: unknown) => {
  const result = evaluateScenario(input);
  assert.ok(result.valid, JSON.stringify(result.errors));
  return result;
};
const district = (result: ReturnType<typeof valid>, id: DistrictId) => {
  const found = result.districts.find(item => item.districtId === id);
  assert.ok(found);
  return found;
};
const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
};
const permutations = <T>(values: readonly T[]): T[][] => values.length < 2
  ? [Array.from(values)]
  : values.flatMap((item, index) => permutations(values.filter((_, i) => i !== index))
    .map(rest => [item, ...rest]));
function assertFiniteJson(value: unknown): void {
  if (typeof value === 'number') assert.ok(Number.isFinite(value));
  if (Array.isArray(value)) value.forEach(assertFiniteJson);
  else if (value && typeof value === 'object') Object.values(value).forEach(assertFiniteJson);
}

test('baseline has independently specified district scores and threshold count', () => {
  const baseline = getBaseline();
  for (const [index, expected] of [62.99, 57.06, 54.65, 56.63, 49.18].entries()) {
    close(baseline.districts[index]!.score, expected);
  }
  close(baseline.cityAverage, 56.8624);
  close(baseline.score, 52.55768);
  assert.equal(baseline.criticalCount, 2);
  assert.deepEqual(baseline.criticalIndicators.map(({ districtId, indicatorId }) =>
    [districtId, indicatorId]), [['nura', 'S1'], ['nura', 'S2']]);
  assert.deepEqual(baseline.weakestDistrictIds, ['nura']);
});

test('published 95-cost example matches all independent controls without rounding', () => {
  const result = valid(structuredClone(EXAMPLE_DECISIONS));
  assert.equal(result.totalCost, 95);
  assert.equal(result.remainingBudget, 5);
  for (const [index, expected] of [63.4275, 57.4975, 56.3, 57.0675, 52.9625].entries()) {
    close(result.districts[index]!.scoreAfter, expected);
  }
  close(result.cityAverageAfter, 58.0776);
  close(result.finalScore, 56.54307);
  close(result.scoreDelta, 3.98539);
  assert.equal(result.criticalAfter, 0);
  assert.deepEqual(result.activatedSynergies, ['M10+M12']);
  const nura = district(result, 'nura');
  close(nura.indicatorsAfter.S1, 48);
  close(nura.indicatorsAfter.S2, 43.75);
  close(nura.indicatorsAfter.B1, 67.5);
  close(nura.indicatorsAfter.B2, 51.75);
  close(district(result, 'saryarka').indicatorsAfter.E2, 48.75);
  close(district(result, 'saryarka').indicatorsAfter.C1, 47.5);
});

test('independent 98-cost example retains full fractional precision', () => {
  const result = valid(structuredClone(SECOND_EXAMPLE_DECISIONS));
  assert.equal(result.totalCost, 98);
  for (const [index, expected] of [64.105, 58.175, 55.765, 57.745, 54.09125].entries()) {
    close(result.districts[index]!.scoreAfter, expected);
  }
  close(result.cityAverageAfter, 58.5848);
  close(result.finalScore, 57.236735);
  assert.equal(result.criticalAfter, 0);
});

test('M1 + M2 adds an unlagged T1 bonus only at M1 district', () => {
  const result = valid([
    decision('M1', 'nura'), decision('M2'), decision('M4', 'yesil'),
    decision('M9', 'almaty'), decision('M12'),
  ]);
  assert.deepEqual(result.activatedSynergies, ['M1+M2']);
  close(district(result, 'nura').indicatorsAfter.T1, 64.5);
  close(district(result, 'nura').indicatorsAfter.T2, 46.75);
  close(district(result, 'yesil').indicatorDeltas.T1, 3);
  assert.deepEqual(result.synergies[0]!.effects, { T1: 2 });
});

test('M10 + M12 bonus is local and contributions disclose non-additive observation', () => {
  const result = valid(structuredClone(EXAMPLE_DECISIONS));
  const m10 = result.contributions.find(item => item.measureId === 'M10')!;
  assert.deepEqual(m10.fullEffects, { B1: 12, B2: 2 });
  assert.deepEqual(m10.realizedEffects, { B1: 10.5, B2: 1.75 });
  assert.deepEqual(m10.observedDistrictDeltas,
    [{ districtId: 'nura', indicatorDeltas: { B1: 12.5, B2: 1.75 } }]);
  assert.deepEqual(result.synergies[0], {
    id: 'M10+M12', measureIds: ['M10', 'M12'], districtId: 'nura', effects: { B1: 2 },
  });
  const m12 = result.contributions.find(item => item.measureId === 'M12')!;
  assert.equal(m12.cost, 14);
  assert.equal(m12.targetDistrictIds.length, 5);
  assert.deepEqual(m12.observedDistrictDeltas.map(item => item.indicatorDeltas.C2),
    [4.375, 4.375, 4.375, 4.375, 4.375]);
});

test('M5 + M6 adds an unlagged E2 bonus only at M5 district', () => {
  const result = valid([
    decision('M5', 'saryarka'), decision('M6'), decision('M9', 'nura'),
    decision('M10', 'nura'), decision('M12'),
  ]);
  assert.ok(result.activatedSynergies.includes('M5+M6'));
  close(district(result, 'saryarka').indicatorsAfter.E2, 52.25);
  close(district(result, 'yesil').indicatorDeltas.E2, 1.5);
  for (const item of result.districts) close(item.indicatorDeltas.E1, 2.5);
  assert.deepEqual(result.synergies.find(item => item.id === 'M5+M6')?.effects, { E2: 2 });
});

test('M11 has a negative lagged T1 effect alongside positive B2', () => {
  const result = valid([
    decision('M3', 'nura'), decision('M4', 'saryarka'), decision('M9', 'yesil'),
    decision('M11', 'nura'), decision('M14'),
  ]);
  close(district(result, 'nura').indicatorsAfter.T1, 61.25);
  close(district(result, 'nura').indicatorsAfter.B2, 60.5);
  const m11 = result.contributions.find(item => item.measureId === 'M11')!;
  assert.equal(m11.fullEffects.T1, -2);
  assert.equal(m11.realizedEffects.T1, -1.75);
  assert.equal(m11.realizedEffects.B2, 10.5);
});

test('threshold is strictly below 40 at 39.999, 40 and 40.001', () => {
  const snapshots = (structuredClone(DISTRICTS) as District[]).map(item => ({
    id: item.id, indicators: item.indicators,
  }));
  const nura = snapshots.find(item => item.id === 'nura')!;
  nura.indicators.S2 = 40;
  for (const [value, expected] of [[39.999, 1], [40, 0], [40.001, 0]]) {
    nura.indicators.S1 = value;
    assert.equal(countCriticalIndicators(nura.indicators), expected);
    assert.equal(evaluateIndicators(snapshots).criticalCount, expected);
  }
});

test('all effects sum before clipping and offsetting effects retain their value', () => {
  const indicators = { ...DISTRICTS[0]!.indicators, T1: 95, T2: 5 };
  const snapshot = structuredClone(indicators);
  assert.equal(clip(105), 100);
  assert.equal(clip(-5), 0);
  const effects = [{ T1: 20, T2: -20 }, { T1: -20, T2: 20 }];
  assert.deepEqual(applyIndicatorEffects(indicators, effects), indicators);
  assert.deepEqual(applyIndicatorEffects(indicators, [...effects].reverse()), indicators);
  assert.equal(applyIndicatorEffects(indicators, [{ T1: 20 }]).T1, 100);
  assert.equal(applyIndicatorEffects(indicators, [{ T2: -20 }]).T2, 0);
  assert.deepEqual(indicators, snapshot);
});

test('low-level score keeps decimals and official Score is not clipped', () => {
  const values = { ...DISTRICTS[0]!.indicators, T1: 50.123 };
  close(calculateDistrictScore(values) - calculateDistrictScore(DISTRICTS[0]!.indicators), 0.5123);
  const zero = (structuredClone(DISTRICTS) as District[]).map(item => ({
    id: item.id,
    indicators: Object.fromEntries(Object.keys(item.indicators).map(key => [key, 0])) as typeof item.indicators,
  }));
  const allZero = evaluateIndicators(zero);
  assert.equal(allZero.criticalCount, 50);
  assert.equal(allZero.score, -50);
  for (const item of zero) {
    for (const key of Object.keys(item.indicators) as (keyof typeof item.indicators)[]) {
      item.indicators[key] = 100;
    }
  }
  assert.equal(evaluateIndicators(zero).score, 100);
});

test('empty and malformed selections never receive a final Score', () => {
  for (const input of [[], null, [decision('M12')]]) {
    const result: ScenarioResult = evaluateScenario(input);
    assert.equal(result.valid, false);
    assert.equal(result.finalScore, null);
    assert.equal(result.scoreDelta, null);
    assert.equal(result.criticalAfter, null);
    assert.deepEqual(result.districts, []);
    assert.deepEqual(result.contributions, []);
    assert.deepEqual(result.activatedSynergies, []);
    close(result.baselineScore, 52.55768);
  }
});

test('all 120 permutations and repeated calls produce the same finite JSON', () => {
  const input = structuredClone(EXAMPLE_DECISIONS);
  const reference = valid(input);
  for (const reordered of permutations(input)) {
    const result = valid(reordered);
    assert.deepEqual(result, reference);
    assertFiniteJson(result);
    assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
  }
  assert.deepEqual(valid(input), reference);
});

test('caller input and canonical data stay deeply unchanged', () => {
  const input = deepFreeze(structuredClone(EXAMPLE_DECISIONS));
  const inputCopy = structuredClone(input);
  const districtsCopy = structuredClone(DISTRICTS);
  const measuresCopy = structuredClone(MEASURES);
  const first = valid(input);
  first.districts[0]!.indicatorsAfter.T1 = 0;
  first.contributions[0]!.fullEffects.S1 = 999;
  assert.deepEqual(input, inputCopy);
  assert.deepEqual(DISTRICTS, districtsCopy);
  assert.deepEqual(MEASURES, measuresCopy);
  close(valid(input).finalScore, 56.54307);
  close(getBaseline().score, 52.55768);
});
