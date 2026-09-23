import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDecisions, simulateScenario } from '../index.mjs';
import { EXAMPLE_DECISIONS } from '../data.mjs';

const example = () => structuredClone(EXAMPLE_DECISIONS);
const decision = (measureId, districtId) => districtId === undefined
  ? { measureId }
  : { measureId, districtId };

function expectError(decisions, code) {
  const validation = validateDecisions(decisions);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some(error => error.code === code),
    `Expected ${code}; received ${JSON.stringify(validation.errors)}`);
  for (const error of validation.errors) {
    assert.equal(typeof error.message, 'string');
    assert.ok(error.message.length > 0);
  }
  const simulation = simulateScenario(decisions);
  assert.equal(simulation.valid, false);
  assert.equal(simulation.result, null, 'Invalid scenarios must never receive a score');
  assert.deepEqual(simulation.validation, validation);
  return validation;
}

test('provided example is valid and preserves the common budget of 100', () => {
  const result = validateDecisions(example());
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.budget, { limit: 100, spent: 95, remaining: 5 });
  assert.equal(result.decisionCount, 5);
  assert.deepEqual(Object.values(result.categoryCounts).filter(Boolean).sort(), [1, 1, 1, 2]);
});

test('the cheapest published scenario is valid at cost 61', () => {
  const result = validateDecisions([
    decision('M9', 'nura'), decision('M11', 'nura'), decision('M10', 'nura'),
    decision('M12'), decision('M4', 'saryarka'),
  ]);
  assert.equal(result.valid, true);
  assert.equal(result.budget.spent, 61);
  assert.equal(result.budget.remaining, 39);
});

test('budget of exactly 100 is accepted', () => {
  const result = validateDecisions([
    decision('M3', 'nura'), decision('M7', 'nura'), decision('M6'),
    decision('M14'), decision('M11', 'nura'),
  ]);
  assert.equal(result.valid, true);
  assert.deepEqual(result.budget, { limit: 100, spent: 100, remaining: 0 });
});

test('budget of 101 is rejected without calculating a score', () => {
  const result = expectError([
    decision('M1', 'nura'), decision('M2'), decision('M5', 'saryarka'),
    decision('M6'), decision('M14'),
  ], 'BUDGET_EXCEEDED');
  assert.equal(result.budget.spent, 101);
  assert.equal(result.budget.remaining, -1);
});

for (const count of [0, 1, 4, 6]) {
  test(`exactly five decisions are required: ${count} rejected`, () => {
    const decisions = example().slice(0, count);
    if (count === 6) decisions.push(decision('M9', 'yesil'));
    expectError(decisions, 'DECISION_COUNT');
  });
}

test('one measure cannot be repeated, including in different districts', () => {
  const decisions = example();
  decisions[1] = decision('M7', 'almaty');
  expectError(decisions, 'DUPLICATE_MEASURE');
});

test('a direction cannot contain three measures', () => {
  expectError([
    decision('M7', 'nura'), decision('M8', 'nura'), decision('M9', 'yesil'),
    decision('M10', 'nura'), decision('M12'),
  ], 'CATEGORY_LIMIT');
});

test('district measures require a district', () => {
  const decisions = example();
  decisions[0] = decision('M7');
  expectError(decisions, 'DISTRICT_REQUIRED');
});

for (const districtId of ['nura', null, undefined]) {
  test(`city measures forbid a district property (${String(districtId)})`, () => {
    const decisions = example();
    decisions[3] = { measureId: 'M12', districtId };
    expectError(decisions, 'DISTRICT_NOT_ALLOWED');
  });
}

for (const measureId of ['M99', '__proto__', 'constructor', 'toString']) {
  test(`unknown or prototype-like measure ${measureId} is rejected safely`, () => {
    const decisions = example();
    decisions[0] = decision(measureId, 'nura');
    expectError(decisions, 'UNKNOWN_MEASURE');
  });
}

for (const districtId of ['unknown', '__proto__', 'constructor', 'toString']) {
  test(`unknown or prototype-like district ${districtId} is rejected safely`, () => {
    const decisions = example();
    decisions[0].districtId = districtId;
    expectError(decisions, 'UNKNOWN_DISTRICT');
  });
}

for (const input of [null, undefined, {}, 'M7', 5, true]) {
  test(`non-array input ${JSON.stringify(input)} is rejected safely`, () => {
    expectError(input, 'INVALID_INPUT');
  });
}

for (const input of [null, undefined, [], 'M7', 7, false]) {
  test(`malformed decision ${JSON.stringify(input)} is rejected safely`, () => {
    const decisions = example();
    decisions[0] = input;
    expectError(decisions, 'INVALID_DECISION');
  });
}

test('unrecognized decision fields cannot silently override the model', () => {
  const decisions = example();
  decisions[0].cost = 0;
  expectError(decisions, 'INVALID_FIELDS');
});

test('BRT and LRT conflict globally even when selected for different districts', () => {
  expectError([
    decision('M1', 'nura'), decision('M3', 'yesil'), decision('M4', 'saryarka'),
    decision('M9', 'almaty'), decision('M10', 'baikonur'),
  ], 'INCOMPATIBLE_MEASURES');
});

for (const [first, second, filler] of [
  ['M4', 'M7', [decision('M10', 'yesil'), decision('M12'), decision('M9', 'almaty')]],
  ['M5', 'M13', [decision('M9', 'yesil'), decision('M10', 'almaty'), decision('M11', 'baikonur')]],
]) {
  test(`${first} and ${second} conflict in the same district`, () => {
    expectError([decision(first, 'nura'), decision(second, 'nura'), ...filler],
      'INCOMPATIBLE_MEASURES');
  });

  test(`${first} and ${second} can be combined in different districts`, () => {
    assert.equal(validateDecisions([
      decision(first, 'nura'), decision(second, 'saryarka'), ...filler,
    ]).valid, true);
  });
}

test('validation never mutates the supplied decisions', () => {
  const decisions = example();
  const snapshot = structuredClone(decisions);
  for (const item of decisions) Object.freeze(item);
  Object.freeze(decisions);
  validateDecisions(decisions);
  assert.deepEqual(decisions, snapshot);
});

test('sparse arrays with length five cannot bypass decision validation', () => {
  expectError(new Array(5), 'INVALID_DECISION');
  const decisions = example();
  delete decisions[1];
  assert.equal(decisions.length, 5);
  expectError(decisions, 'INVALID_DECISION');
});

test('an unknown measure makes total cost and remaining budget unknown', () => {
  const decisions = example();
  decisions[0] = decision('M99', 'nura');
  const result = expectError(decisions, 'UNKNOWN_MEASURE');
  assert.deepEqual(result.budget, { limit: 100, spent: null, remaining: null });
});
