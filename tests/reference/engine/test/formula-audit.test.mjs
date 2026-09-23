import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DISTRICTS, INDICATORS, MEASURES, SYNERGIES,
  simulateScenario, validateDecisions,
} from '../index.mjs';

// A direct implementation of the PDF formula, separate from the engine's scaled arithmetic.
function calculateFromFormula(decisions) {
  const selected = new Map(decisions.map(decision => [decision.measureId, decision]));
  const measures = new Map(MEASURES.map(measure => [measure.id, measure]));
  const districtResults = DISTRICTS.map(district => {
    const indicators = {...district.indicators};

    for (const decision of decisions) {
      const measure = measures.get(decision.measureId);
      if (measure.scope === 'district' && decision.districtId !== district.id) continue;
      for (const [code, effect] of Object.entries(measure.effects)) {
        indicators[code] += effect * (8 - measure.lagQuarters) / 8;
      }
    }

    for (const synergy of SYNERGIES) {
      if (!synergy.measureIds.every(id => selected.has(id))) continue;
      if (selected.get(synergy.targetMeasureId).districtId !== district.id) continue;
      for (const [code, effect] of Object.entries(synergy.effects)) {
        indicators[code] += effect;
      }
    }

    for (const code of Object.keys(indicators)) {
      indicators[code] = Math.max(0, Math.min(100, indicators[code]));
    }
    const score = INDICATORS.reduce((sum, {id, weight}) => sum + weight * indicators[id], 0);
    const criticalCount = Object.values(indicators).filter(value => value < 40).length;
    return {district, indicators, score, criticalCount};
  });

  const average = districtResults.reduce(
    (sum, {district, score}) => sum + district.populationShare * score, 0,
  );
  const weakest = Math.min(...districtResults.map(({score}) => score));
  const criticalCount = districtResults.reduce((sum, district) => sum + district.criticalCount, 0);
  return {
    districtResults,
    average,
    weakest,
    criticalCount,
    score: 0.7 * average + 0.3 * weakest - criticalCount,
  };
}

function almostEqual(actual, expected, description) {
  assert.ok(Math.abs(actual - expected) < 1e-9,
    `${description}: expected ${expected}, received ${actual}`);
}

let randomState = 0x5eed1234;
function random(max) {
  randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
  return randomState % max;
}

test('1,000 valid selections match an independent calculation of every formula component', () => {
  let checked = 0;
  const seenMeasures = new Set();
  const seenSynergies = new Set();
  let scenariosWithCriticalIndicators = 0;
  for (let attempt = 0; attempt < 100000 && checked < 1000; attempt++) {
    const selectedMeasures = [...MEASURES];
    for (let i = selectedMeasures.length - 1; i > 0; i--) {
      const j = random(i + 1);
      [selectedMeasures[i], selectedMeasures[j]] = [selectedMeasures[j], selectedMeasures[i]];
    }
    const decisions = selectedMeasures.slice(0, 5).map(measure =>
      measure.scope === 'city' ? {measureId: measure.id} : {
        measureId: measure.id,
        districtId: DISTRICTS[random(DISTRICTS.length)].id,
      });
    if (!validateDecisions(decisions).valid) continue;

    const expected = calculateFromFormula(decisions);
    const actual = simulateScenario(decisions);
    assert.equal(actual.valid, true);
    for (const decision of decisions) seenMeasures.add(decision.measureId);
    for (const synergy of actual.result.synergies) seenSynergies.add(synergy.id);
    if (actual.result.after.criticalCount > 0) scenariosWithCriticalIndicators++;
    almostEqual(actual.result.after.score, expected.score, 'final Score');
    almostEqual(actual.result.after.populationWeightedScore, expected.average, 'population average');
    almostEqual(actual.result.after.weakestDistrictScore, expected.weakest, 'weakest district');
    assert.equal(actual.result.after.criticalCount, expected.criticalCount);

    for (let i = 0; i < DISTRICTS.length; i++) {
      const district = actual.result.after.districts[i];
      const oracleDistrict = expected.districtResults[i];
      almostEqual(district.score, oracleDistrict.score, `district ${district.id}`);
      for (const indicator of INDICATORS) {
        almostEqual(district.indicators[indicator.id], oracleDistrict.indicators[indicator.id],
          `${district.id}/${indicator.id}`);
      }
    }
    checked++;
  }
  assert.equal(checked, 1000, 'the audit must cover enough valid scenarios');
  assert.deepEqual(seenMeasures, new Set(MEASURES.map(measure => measure.id)));
  assert.deepEqual(seenSynergies, new Set(SYNERGIES.map(synergy => synergy.id)));
  assert.ok(scenariosWithCriticalIndicators > 0);
});
