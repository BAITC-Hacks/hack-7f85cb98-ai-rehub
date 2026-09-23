import test from 'node:test';
import assert from 'node:assert/strict';
import {
  simulateScenario, getBaseline, evaluateIndicators, applyIndicatorEffects,
} from '../index.mjs';
import { DISTRICTS, EXAMPLE_DECISIONS } from '../data.mjs';

const decision = (measureId, districtId) => districtId === undefined
  ? { measureId }
  : { measureId, districtId };
const example = () => structuredClone(EXAMPLE_DECISIONS);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9,
  `Expected ${expected}; received ${actual}`);
const district = (evaluation, id) => evaluation.districts.find(item => item.id === id);
function run(decisions) {
  const simulation = simulateScenario(decisions);
  assert.equal(simulation.valid, true, JSON.stringify(simulation.validation.errors));
  assert.ok(simulation.result);
  return simulation.result;
}

test('baseline matches independently audited values, without early rounding', () => {
  const baseline = getBaseline();
  const scores = { yesil: 62.99, almaty: 57.06, saryarka: 54.65, baikonur: 56.63, nura: 49.18 };
  for (const [id, score] of Object.entries(scores)) close(district(baseline, id).score, score);
  close(baseline.populationWeightedScore, 56.8624);
  close(baseline.weakestDistrictScore, 49.18);
  assert.deepEqual(baseline.weakestDistrictIds, ['nura']);
  assert.equal(baseline.criticalCount, 2);
  close(baseline.score, 52.55768);
  close(baseline.scoreComponents.average, 39.80368);
  close(baseline.scoreComponents.weakest, 14.754);
  assert.equal(baseline.scoreComponents.criticalPenalty, -2);
  assert.deepEqual(baseline.criticalIndicators.map(item => [item.districtId, item.indicatorId, item.value]),
    [['nura', 'S1', 38], ['nura', 'S2', 35]]);
  assert.deepEqual(evaluateIndicators(DISTRICTS), baseline);
});

test('published example has exact expected district, city, and final scores', () => {
  const result = run(example());
  const scores = { yesil: 63.4275, almaty: 57.4975, saryarka: 56.3, baikonur: 57.0675, nura: 52.9625 };
  for (const [id, score] of Object.entries(scores)) close(district(result.after, id).score, score);
  close(result.after.populationWeightedScore, 58.0776);
  close(result.after.weakestDistrictScore, 52.9625);
  assert.equal(result.after.criticalCount, 0);
  close(result.after.score, 56.54307);
  close(result.delta.score, 3.98539);
  close(result.delta.populationWeightedScore, 1.2152);
  close(result.delta.weakestDistrictScore, 3.7825);
  assert.equal(result.delta.criticalCount, -2);
  close(result.delta.scoreComponents.average, 0.85064);
  close(result.delta.scoreComponents.weakest, 1.13475);
  assert.equal(result.delta.scoreComponents.criticalPenalty, 2);
  assert.deepEqual(result.baseline, getBaseline());
  assert.equal(result.districtChanges.length, 5);
  assert.equal(result.measureEffects.length, 5);
});

test('district effects remain local, lagged, and city service effects reach all districts', () => {
  const { after, baseline } = run(example());
  const nura = district(after, 'nura').indicators;
  assert.equal(nura.S1, 48); // 38 + 16 * 5/8
  assert.equal(nura.S2, 43.75); // 35 + 14 * 5/8
  assert.equal(nura.B1, 67.5); // 55 + 12 * 7/8 + fixed synergy 2
  assert.equal(nura.B2, 51.75);
  assert.equal(district(after, 'saryarka').indicators.E2, 48.75);
  assert.equal(district(after, 'saryarka').indicators.C1, 47.5);
  for (const before of baseline.districts) {
    const actual = district(after, before.id).indicators;
    assert.equal(actual.C2 - before.indicators.C2, 4.375);
    if (before.id !== 'nura') assert.equal(actual.S1, before.indicators.S1);
    if (before.id !== 'saryarka') assert.equal(actual.E2, before.indicators.E2);
  }
});

test('lag 2 realizes three quarters, lag 4 realizes one half, and negative effects remain negative', () => {
  const { after, baseline } = run([
    decision('M3', 'nura'), decision('M4', 'saryarka'), decision('M9', 'yesil'),
    decision('M11', 'nura'), decision('M14'),
  ]);
  const nura = district(after, 'nura').indicators;
  assert.equal(nura.T1, 61.25); // 55 + 16/2 - 2*7/8
  assert.equal(nura.T2, 50);
  assert.equal(nura.E2, 67);
  assert.equal(nura.B2, 60.5);
  const saryarka = district(after, 'saryarka').indicators;
  assert.equal(saryarka.E1, 51);
  assert.equal(saryarka.E2, 42.25);
  assert.equal(saryarka.B1, 59.5);
  const yesil = district(after, 'yesil').indicators;
  assert.equal(yesil.S1, 50.625);
  assert.equal(yesil.S2, 57.625);
  assert.equal(yesil.B1, 80.625);
  for (const before of baseline.districts) {
    const actual = district(after, before.id).indicators;
    assert.equal(actual.C1 - before.indicators.C1, 4.375);
    assert.equal(actual.C2 - before.indicators.C2, 1.75);
  }
});

test('heat and water modernization has a four-quarter lag and local effects', () => {
  const { after } = run([
    decision('M13', 'almaty'), decision('M4', 'saryarka'), decision('M9', 'yesil'),
    decision('M11', 'nura'), decision('M12'),
  ]);
  assert.equal(district(after, 'almaty').indicators.C1, 59);
  assert.equal(district(after, 'almaty').indicators.E2, 56);
  assert.equal(district(after, 'nura').indicators.C1, 60);
});

test('M1 + M2 fixed synergy applies only in the bus-lane district', () => {
  const result = run([
    decision('M1', 'nura'), decision('M2'), decision('M4', 'yesil'),
    decision('M9', 'almaty'), decision('M12'),
  ]);
  const synergy = result.synergies.find(item => item.id === 'M1+M2');
  assert.ok(synergy);
  assert.equal(synergy.districtId, 'nura');
  assert.deepEqual(synergy.effects, { T1: 2 });
  assert.equal(district(result.after, 'nura').indicators.T1, 64.5);
  assert.equal(district(result.after, 'nura').indicators.T2, 46.75);
  for (const before of result.baseline.districts) {
    const actual = district(result.after, before.id).indicators;
    assert.equal(actual.B2 - before.indicators.B2, 2.25);
    if (before.id !== 'nura') assert.equal(actual.T1 - before.indicators.T1, 3);
  }
});

test('M10 + M12 fixed synergy is not scaled by lag', () => {
  const result = run(example());
  assert.deepEqual(result.synergies.map(({ id, districtId, effects }) => ({ id, districtId, effects })),
    [{ id: 'M10+M12', districtId: 'nura', effects: { B1: 2 } }]);
  assert.equal(district(result.after, 'nura').indicators.B1, 67.5);
  assert.equal(district(result.after, 'yesil').indicators.B1, 78);
});

test('M5 + M6 synergy is local while the greening program is citywide', () => {
  const result = run([
    decision('M5', 'saryarka'), decision('M6'), decision('M9', 'nura'),
    decision('M10', 'nura'), decision('M12'),
  ]);
  const synergy = result.synergies.find(item => item.id === 'M5+M6');
  assert.ok(synergy);
  assert.equal(synergy.districtId, 'saryarka');
  assert.deepEqual(synergy.effects, { E2: 2 });
  assert.equal(district(result.after, 'saryarka').indicators.E2, 52.25);
  for (const before of result.baseline.districts) {
    const actual = district(result.after, before.id).indicators;
    assert.equal(actual.E1 - before.indicators.E1, 2.5);
    if (before.id !== 'saryarka') assert.equal(actual.E2 - before.indicators.E2, 1.5);
  }
});

test('unpaired measures do not create a synergy', () => {
  const result = run([
    decision('M1', 'nura'), decision('M4', 'saryarka'), decision('M9', 'yesil'),
    decision('M10', 'nura'), decision('M14'),
  ]);
  assert.deepEqual(result.synergies, []);
  assert.equal(district(result.after, 'nura').indicators.T1, 59.5);
  assert.equal(district(result.after, 'nura').indicators.B1, 65.5);
});

test('changing the decisions changes score and can change the weakest district', () => {
  const result = run([
    decision('M3', 'nura'), decision('M7', 'nura'), decision('M8', 'nura'),
    decision('M10', 'nura'), decision('M11', 'nura'),
  ]);
  close(district(result.after, 'nura').score, 55.135);
  close(result.after.weakestDistrictScore, 54.65);
  assert.deepEqual(result.after.weakestDistrictIds, ['saryarka']);
  close(result.after.populationWeightedScore, 57.8152);
  close(result.after.score, 56.86564);
  assert.notEqual(result.after.score, run(example()).after.score);
});

test('critical threshold is strictly below 40, not less than or equal to 40', () => {
  const districts = structuredClone(DISTRICTS);
  const nura = districts.find(item => item.id === 'nura');
  nura.indicators.S1 = 40;
  nura.indicators.S2 = 40;
  assert.equal(evaluateIndicators(districts).criticalCount, 0);
  nura.indicators.S1 = 39.875;
  const result = evaluateIndicators(districts);
  assert.equal(result.criticalCount, 1);
  assert.equal(result.scoreComponents.criticalPenalty, -1);
  assert.deepEqual(result.criticalIndicators.map(item => [item.districtId, item.indicatorId]),
    [['nura', 'S1']]);
});

test('all effect contributions are summed before clipping to 0–100', () => {
  const indicators = structuredClone(DISTRICTS[0].indicators);
  indicators.T1 = 95;
  indicators.T2 = 5;
  const effects = [{ T1: 20, T2: -20 }, { T1: -10, T2: 10 }];
  const snapshot = structuredClone(indicators);
  const result = applyIndicatorEffects(indicators, effects);
  assert.equal(result.T1, 100);
  assert.equal(result.T2, 0);
  assert.deepEqual(result, applyIndicatorEffects(indicators, [...effects].reverse()));
  assert.deepEqual(indicators, snapshot);
  assert.equal(result.E1, indicators.E1);
});

test('offsetting effects near bounds are not lost by premature clipping', () => {
  const indicators = structuredClone(DISTRICTS[0].indicators);
  indicators.T1 = 95;
  indicators.T2 = 5;
  const result = applyIndicatorEffects(indicators, [{ T1: 20, T2: -20 }, { T1: -20, T2: 20 }]);
  assert.equal(result.T1, 95);
  assert.equal(result.T2, 5);
});

test('decision order does not change the full simulation result', () => {
  const decisions = example();
  const expected = run(decisions);
  assert.deepEqual(run([...decisions].reverse()), expected);
  assert.deepEqual(run([decisions[3], decisions[0], decisions[4], decisions[2], decisions[1]]), expected);
});

test('simulation leaves caller decisions and shared district data unchanged', () => {
  const decisions = example();
  const beforeDecisions = structuredClone(decisions);
  const beforeDistricts = structuredClone(DISTRICTS);
  for (const item of decisions) Object.freeze(item);
  Object.freeze(decisions);
  run(decisions);
  assert.deepEqual(decisions, beforeDecisions);
  assert.deepEqual(DISTRICTS, beforeDistricts);
  assert.deepEqual(getBaseline(), evaluateIndicators(beforeDistricts));
});

test('mutating returned baseline and result cannot corrupt later calculations', () => {
  const expectedBaseline = getBaseline();
  const expectedScenario = run(example());
  const baseline = getBaseline();
  baseline.districts[0].indicators.T1 = 0;
  baseline.districts.pop();
  baseline.scoreComponents.average = -1000;
  baseline.criticalIndicators[0].value = 100;
  baseline.weakestDistrictIds.push('yesil');
  const result = run(example());
  result.baseline.districts[0].indicators.T1 = 0;
  result.after.districts[0].indicators.T1 = 0;
  result.after.scoreComponents.average = -1000;
  result.districtChanges[0].indicators.T1.after = 0;
  result.measureEffects[0].effects.E2 = 100;
  result.measureEffects[0].districtIds.push('yesil');
  result.synergies[0].effects.B1 = 100;
  result.delta.score = -1000;
  assert.deepEqual(getBaseline(), expectedBaseline);
  assert.deepEqual(run(example()), expectedScenario);
});

for (const [value, expectedScore, expectedCriticalCount] of [[0, -50, 50], [100, 100, 0]]) {
  test(`all indicators at ${value}: correct ties, critical count, and unclipped city score`, () => {
    const districts = structuredClone(DISTRICTS);
    for (const item of districts) {
      for (const id of Object.keys(item.indicators)) item.indicators[id] = value;
    }
    const result = evaluateIndicators(districts);
    assert.equal(result.score, expectedScore);
    assert.equal(result.populationWeightedScore, value);
    assert.equal(result.weakestDistrictScore, value);
    assert.equal(result.criticalCount, expectedCriticalCount);
    assert.equal(result.criticalIndicators.length, expectedCriticalCount);
    assert.deepEqual(result.weakestDistrictIds, DISTRICTS.map(item => item.id));
  });
}

for (const value of [0.1, NaN]) {
  test(`evaluator rejects unsupported indicator value ${String(value)}`, () => {
    const districts = structuredClone(DISTRICTS);
    districts[0].indicators.T1 = value;
    assert.throws(() => evaluateIndicators(districts), TypeError);
  });
}
