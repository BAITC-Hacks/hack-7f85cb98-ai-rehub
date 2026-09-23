import test from 'node:test';
import assert from 'node:assert/strict';
import * as data from '../data.mjs';

const { MODEL_VERSION, RULES, CATEGORIES, INDICATORS, DISTRICTS, MEASURES,
  SYNERGIES, INCOMPATIBILITIES, EXAMPLE_DECISIONS } = data;
const indicatorIds = ['T1', 'T2', 'E1', 'E2', 'S1', 'S2', 'B1', 'B2', 'C1', 'C2'];
const categoryIds = ['transport', 'ecology', 'social', 'safety', 'services'];
const approximately = (actual, expected) => assert.ok(
  Math.abs(actual - expected) < 1e-10, `${actual} differs from ${expected}`,
);

test('model constants preserve the supplied rules and weights', () => {
  assert.equal(MODEL_VERSION, '1.0.0');
  assert.deepEqual(RULES, {
    budget: 100, decisionCount: 5, maxPerCategory: 2, horizonQuarters: 8,
    criticalThreshold: 40, criticalPenalty: 1, averageWeight: 0.7, weakestWeight: 0.3,
  });
  assert.deepEqual(CATEGORIES.map(({ id }) => id), categoryIds);
  assert.deepEqual(INDICATORS.map(({ id }) => id), indicatorIds);
  assert.deepEqual(INDICATORS.map(({ weight }) => weight), [0.10, 0.10, 0.09, 0.11, 0.11, 0.11, 0.09, 0.09, 0.10, 0.10]);
  assert.deepEqual(INDICATORS.map(({ category }) => category), categoryIds.flatMap(id => [id, id]));
  approximately(INDICATORS.reduce((total, { weight }) => total + weight, 0), 1);
  approximately(RULES.averageWeight + RULES.weakestWeight, 1);
  for (const item of [...CATEGORIES, ...INDICATORS]) assert.ok(item.name.length > 0);
});

test('all 50 initial values and population shares match the task dataset', () => {
  // Independent compact transcription of the source table, in indicatorIds order.
  const expected = [
    ['yesil', 'Есиль', 0.27, 45, 62, 68, 72, 48, 55, 78, 60, 75, 70],
    ['almaty', 'Алматы', 0.24, 40, 75, 50, 55, 60, 65, 62, 52, 50, 60],
    ['saryarka', 'Сарыарка', 0.20, 50, 70, 42, 40, 62, 68, 58, 55, 45, 55],
    ['baikonur', 'Байконур', 0.13, 52, 68, 55, 50, 58, 60, 52, 58, 55, 58],
    ['nura', 'Нура', 0.16, 55, 40, 45, 65, 38, 35, 55, 50, 60, 50],
  ];
  assert.deepEqual(DISTRICTS.map(d => [d.id, d.name, d.populationShare,
    ...indicatorIds.map(id => d.indicators[id])]), expected);
  approximately(DISTRICTS.reduce((total, d) => total + d.populationShare, 0), 1);
  for (const district of DISTRICTS) {
    assert.deepEqual(Object.keys(district.indicators), indicatorIds);
    assert.ok(district.profile.length > 0);
    assert.ok(district.populationShare > 0 && district.populationShare <= 1);
    for (const value of Object.values(district.indicators)) {
      assert.ok(Number.isFinite(value) && value >= 0 && value <= 100);
    }
  }
});

test('dataset independently reproduces baseline district totals and Score', () => {
  const districtScores = DISTRICTS.map(d => INDICATORS.reduce(
    (total, { id, weight }) => total + weight * d.indicators[id], 0,
  ));
  [62.99, 57.06, 54.65, 56.63, 49.18].forEach((expected, i) => {
    approximately(districtScores[i], expected);
  });
  const average = DISTRICTS.reduce((total, d, i) => total + d.populationShare * districtScores[i], 0);
  approximately(average, 56.8624);
  const critical = DISTRICTS.flatMap(d => Object.entries(d.indicators)
    .filter(([, value]) => value < RULES.criticalThreshold)
    .map(([id]) => `${d.id}/${id}`));
  assert.deepEqual(critical, ['nura/S1', 'nura/S2']);
  approximately(RULES.averageWeight * average + RULES.weakestWeight * Math.min(...districtScores)
    - RULES.criticalPenalty * critical.length, 52.55768);
});

test('all 14 measures preserve costs, lags, scopes, categories and signed effects', () => {
  const expected = [
    ['M1', 'transport', 'district', 18, 2, { T1: 6, T2: 9 }],
    ['M2', 'transport', 'city', 22, 2, { T1: 4, B2: 3 }],
    ['M3', 'transport', 'district', 30, 4, { T1: 16, T2: 20, E2: 4 }],
    ['M4', 'ecology', 'district', 15, 2, { E1: 12, E2: 3, B1: 2 }],
    ['M5', 'ecology', 'district', 25, 3, { E2: 14, C1: 4 }],
    ['M6', 'ecology', 'city', 20, 4, { E1: 5, E2: 3 }],
    ['M7', 'social', 'district', 24, 3, { S1: 16 }],
    ['M8', 'social', 'district', 20, 3, { S2: 14 }],
    ['M9', 'social', 'district', 10, 1, { S1: 3, S2: 3, B1: 3 }],
    ['M10', 'safety', 'district', 12, 1, { B1: 12, B2: 2 }],
    ['M11', 'safety', 'district', 10, 1, { B2: 12, T1: -2 }],
    ['M12', 'services', 'city', 14, 1, { C2: 5 }],
    ['M13', 'services', 'district', 28, 4, { C1: 18, E2: 2 }],
    ['M14', 'services', 'city', 16, 1, { C1: 5, C2: 2 }],
  ];
  assert.deepEqual(MEASURES.map(m => [m.id, m.category, m.scope, m.cost, m.lagQuarters, m.effects]), expected);
  for (const measure of MEASURES) {
    assert.ok(measure.name.length > 0);
    assert.ok(Number.isInteger(measure.cost) && measure.cost > 0);
    assert.ok(Number.isInteger(measure.lagQuarters) && measure.lagQuarters >= 0
      && measure.lagQuarters <= RULES.horizonQuarters);
    for (const [indicatorId, effect] of Object.entries(measure.effects)) {
      assert.ok(indicatorIds.includes(indicatorId));
      assert.ok(Number.isFinite(effect));
    }
  }
});

test('synergies and incompatibilities preserve their references and geographic scope', () => {
  assert.deepEqual(SYNERGIES, [
    { id: 'M1+M2', measureIds: ['M1', 'M2'], targetMeasureId: 'M1', effects: { T1: 2 } },
    { id: 'M10+M12', measureIds: ['M10', 'M12'], targetMeasureId: 'M10', effects: { B1: 2 } },
    { id: 'M5+M6', measureIds: ['M5', 'M6'], targetMeasureId: 'M5', effects: { E2: 2 } },
  ]);
  assert.deepEqual(INCOMPATIBILITIES.map(({ measureIds, scope }) => ({ measureIds, scope })), [
    { measureIds: ['M1', 'M3'], scope: 'global' },
    { measureIds: ['M4', 'M7'], scope: 'same-district' },
    { measureIds: ['M5', 'M13'], scope: 'same-district' },
  ]);
  const measuresById = new Map(MEASURES.map(m => [m.id, m]));
  for (const rule of [...SYNERGIES, ...INCOMPATIBILITIES]) {
    assert.equal(new Set(rule.measureIds).size, 2);
    for (const id of rule.measureIds) assert.ok(measuresById.has(id));
  }
  for (const synergy of SYNERGIES) {
    assert.ok(synergy.measureIds.includes(synergy.targetMeasureId));
    assert.equal(measuresById.get(synergy.targetMeasureId).scope, 'district');
    for (const id of Object.keys(synergy.effects)) assert.ok(indicatorIds.includes(id));
  }
  for (const conflict of INCOMPATIBILITIES) assert.ok(conflict.reason.length > 0);
});

test('example decisions preserve the supplied 95-unit scenario and city targeting', () => {
  assert.deepEqual(EXAMPLE_DECISIONS, [
    { measureId: 'M7', districtId: 'nura' },
    { measureId: 'M8', districtId: 'nura' },
    { measureId: 'M10', districtId: 'nura' },
    { measureId: 'M12' },
    { measureId: 'M5', districtId: 'saryarka' },
  ]);
  assert.equal(EXAMPLE_DECISIONS.length, RULES.decisionCount);
  assert.equal(new Set(EXAMPLE_DECISIONS.map(d => d.measureId)).size, RULES.decisionCount);
  assert.equal(EXAMPLE_DECISIONS.reduce((total, decision) =>
    total + MEASURES.find(m => m.id === decision.measureId).cost, 0), 95);
  const selectedCategories = {};
  for (const decision of EXAMPLE_DECISIONS) {
    const measure = MEASURES.find(m => m.id === decision.measureId);
    assert.ok(measure);
    selectedCategories[measure.category] = (selectedCategories[measure.category] ?? 0) + 1;
    if (measure.scope === 'city') assert.ok(!Object.hasOwn(decision, 'districtId'));
    else assert.ok(DISTRICTS.some(d => d.id === decision.districtId));
  }
  assert.ok(Object.values(selectedCategories).every(count => count <= RULES.maxPerCategory));
});

test('all identifiers are unique and exported objects are deeply immutable', () => {
  for (const list of [CATEGORIES, INDICATORS, DISTRICTS, MEASURES, SYNERGIES]) {
    assert.equal(new Set(list.map(item => item.id)).size, list.length);
  }
  const checkFrozen = (value) => {
    if (value && typeof value === 'object') {
      assert.ok(Object.isFrozen(value));
      Object.values(value).forEach(checkFrozen);
    }
  };
  Object.values(data).forEach(checkFrozen);
  assert.throws(() => { DISTRICTS[0].indicators.T1 = 0; }, TypeError);
  assert.throws(() => { MEASURES[0].effects.T1 = 999; }, TypeError);
  assert.throws(() => { SYNERGIES[0].measureIds.push('M3'); }, TypeError);
  assert.throws(() => { EXAMPLE_DECISIONS[0].districtId = 'yesil'; }, TypeError);
});
