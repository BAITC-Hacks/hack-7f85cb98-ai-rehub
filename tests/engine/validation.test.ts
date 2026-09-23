import test from 'node:test';
import assert from 'node:assert/strict';
import { validateScenario } from '../../src/domain/validateScenario.ts';
import { MEASURES } from '../../src/data/measures.ts';
import type { Decision, ValidationErrorCode } from '../../src/types/simulation.ts';

const d = (measureId: string, districtId?: string): Decision =>
  districtId === undefined ? { measureId } : { measureId, districtId };
const example = (): Decision[] => [
  d('M7', 'nura'), d('M8', 'nura'), d('M10', 'nura'),
  d('M12'), d('M5', 'saryarka'),
];
const codes = (input: unknown): ValidationErrorCode[] =>
  validateScenario(input).errorDetails.map(error => error.code);
function expectCode(input: unknown, code: ValidationErrorCode) {
  const result = validateScenario(input);
  assert.equal(result.valid, false);
  assert.ok(result.errorDetails.some(error => error.code === code),
    `Expected ${code}: ${JSON.stringify(result.errorDetails)}`);
  assert.deepEqual(result.errors, result.errorDetails.map(error => error.message));
  assert.ok(result.errors.every(message => message.length > 0));
  return result;
}

test('published example is valid; prices come from the catalog', () => {
  const input = example();
  const result = validateScenario(input);
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.totalCost, 95);
  assert.equal(result.remainingBudget, 5);
  assert.equal(result.decisionCount, 5);
  assert.notEqual(result.decisions, input);
  assert.deepEqual(result.decisions.map(decision => decision.measureId),
    ['M10', 'M12', 'M5', 'M7', 'M8']);
});

for (const count of [0, 4, 6]) {
  test(`decision count ${count} is rejected`, () => {
    const input = example().slice(0, count);
    if (count === 6) input.push(d('M9', 'yesil'));
    const result = expectCode(input, 'DECISION_COUNT');
    assert.equal(result.decisionCount, count);
  });
}

test('exactly 100 is valid with no other rule violations', () => {
  const ids = ['M3', 'M6', 'M7', 'M10', 'M12'];
  assert.equal(MEASURES.filter(measure => ids.includes(measure.id))
    .reduce((sum, measure) => sum + measure.cost, 0), 100);
  const result = validateScenario([
    d('M3', 'nura'), d('M6'), d('M7', 'nura'),
    d('M10', 'yesil'), d('M12'),
  ]);
  assert.equal(result.valid, true, JSON.stringify(result.errorDetails));
  assert.equal(result.totalCost, 100);
  assert.equal(result.remainingBudget, 0);
});

test('101 is rejected solely for budget', () => {
  const result = validateScenario([
    d('M1', 'nura'), d('M2'), d('M5', 'saryarka'),
    d('M6'), d('M14'),
  ]);
  assert.deepEqual(codes([
    d('M1', 'nura'), d('M2'), d('M5', 'saryarka'),
    d('M6'), d('M14'),
  ]), ['BUDGET_EXCEEDED']);
  assert.equal(result.totalCost, 101);
  assert.equal(result.remainingBudget, -1);
});

test('three measures in one direction exceed the category limit', () => {
  const result = validateScenario([
    d('M7', 'nura'), d('M8', 'nura'), d('M9', 'yesil'),
    d('M10', 'nura'), d('M12'),
  ]);
  assert.deepEqual(result.errorDetails.map(error => error.code), ['CATEGORY_LIMIT']);
  assert.equal(result.errorDetails[0].category, 'social');
});

test('a duplicate is global even when districts differ', () => {
  const input = example();
  input[1] = d('M7', 'almaty');
  expectCode(input, 'DUPLICATE_MEASURE');
});

for (const districtId of [undefined, null, '']) {
  test(`district measure requires a district: ${String(districtId)}`, () => {
    const input: unknown[] = example();
    input[0] = { measureId: 'M7', districtId };
    expectCode(input, 'DISTRICT_REQUIRED');
  });
}

test('unknown district is rejected', () => {
  const input = example();
  input[0] = d('M7', '__proto__');
  expectCode(input, 'UNKNOWN_DISTRICT');
});

for (const districtId of ['nura', null, undefined]) {
  test(`city measure forbids an owned districtId: ${String(districtId)}`, () => {
    const input: unknown[] = example();
    input[3] = { measureId: 'M12', districtId };
    expectCode(input, 'DISTRICT_NOT_ALLOWED');
  });
}

const globalConflict = [
  d('M1', 'nura'), d('M3', 'yesil'), d('M4', 'saryarka'),
  d('M9', 'almaty'), d('M10', 'baikonur'),
];
const parkSchool = [
  d('M4', 'nura'), d('M7', 'nura'), d('M10', 'yesil'),
  d('M12'), d('M9', 'almaty'),
];
const heatingUtility = [
  d('M5', 'nura'), d('M13', 'nura'), d('M9', 'yesil'),
  d('M10', 'almaty'), d('M11', 'baikonur'),
];
for (const [name, fixture] of [
  ['M1+M3 global', globalConflict],
  ['M4+M7 same district', parkSchool],
  ['M5+M13 same district', heatingUtility],
] as const) {
  for (const reverse of [false, true]) {
    test(`${name} is rejected in ${reverse ? 'reverse' : 'forward'} order`, () => {
      const input = reverse ? [...fixture].reverse() : fixture;
      const result = validateScenario(input);
      assert.deepEqual(result.errorDetails.map(error => error.code),
        ['INCOMPATIBLE_MEASURES']);
    });
  }
}

test('both local conflict pairs are allowed across districts', () => {
  for (const fixture of [parkSchool, heatingUtility]) {
    const input = fixture.map((decision, index) =>
      index === 1 ? d(decision.measureId, 'saryarka') : decision);
    const result = validateScenario(input);
    assert.equal(result.valid, true, JSON.stringify(result.errorDetails));
  }
});

test('a duplicated measure in the same district still reports the local conflict', () => {
  const result = validateScenario([
    d('M4', 'nura'), d('M4', 'nura'), d('M7', 'nura'),
    d('M10', 'nura'), d('M12'),
  ]);
  assert.deepEqual(result.errorDetails.map(error => error.code),
    ['DUPLICATE_MEASURE', 'INCOMPATIBLE_MEASURES']);
});

test('a duplicate in two districts conflicts when one known district matches', () => {
  const result = validateScenario([
    d('M4', 'nura'), d('M4', 'saryarka'), d('M7', 'saryarka'),
    d('M10', 'nura'), d('M12'),
  ]);
  assert.deepEqual(result.errorDetails.map(error => error.code),
    ['DUPLICATE_MEASURE', 'INCOMPATIBLE_MEASURES']);
});

test('a duplicate with no known matching district adds no local conflict', () => {
  const result = validateScenario([
    d('M4', 'nura'), d('M4', 'unknown'), d('M7', 'saryarka'),
    d('M10', 'nura'), d('M12'),
  ]);
  assert.deepEqual(result.errorDetails.map(error => error.code),
    ['DUPLICATE_MEASURE', 'UNKNOWN_DISTRICT']);
});

test('multiple independent errors are returned together', () => {
  const input = [
    d('M7', 'nura'), d('M7', 'almaty'),
    { measureId: 'M12', districtId: null },
    d('M99', 'nura'), d('M10', 'nura'),
  ];
  const result = validateScenario(input);
  assert.deepEqual(new Set(result.errorDetails.map(error => error.code)),
    new Set(['DUPLICATE_MEASURE', 'DISTRICT_NOT_ALLOWED', 'UNKNOWN_MEASURE']));
  assert.equal(result.totalCost, null);
  assert.equal(result.remainingBudget, null);
  assert.deepEqual(result.decisions, []);
});

test('the order does not affect validity, cost or error set', () => {
  for (const fixture of [example(), globalConflict, parkSchool, heatingUtility]) {
    const first = validateScenario(fixture);
    const second = validateScenario([...fixture].reverse());
    assert.equal(first.valid, second.valid);
    assert.equal(first.totalCost, second.totalCost);
    assert.equal(first.remainingBudget, second.remainingBudget);
    assert.deepEqual(first.errors, second.errors);
    if (first.valid && second.valid) {
      assert.deepEqual(first.decisions, second.decisions);
    }
  }
});

test('caller data remains unchanged and input cost/effects/score are rejected', () => {
  const input = example();
  const frozen = input.map(decision => Object.freeze(decision));
  Object.freeze(frozen);
  const original = structuredClone(frozen);
  validateScenario(frozen);
  assert.deepEqual(frozen, original);
  const tampered: unknown[] = example();
  tampered[0] = { ...example()[0], cost: 0, score: 999, effects: {} };
  const result = expectCode(tampered, 'INVALID_FIELDS');
  assert.equal(result.totalCost, 95);
  assert.deepEqual(result.errorDetails.find(error => error.code === 'INVALID_FIELDS')?.fields,
    ['cost', 'effects', 'score']);
});

for (const input of [null, undefined, 'M7', 3, false, {}]) {
  test(`non-array input ${String(input)} is safe`, () => {
    const result = expectCode(input, 'INVALID_INPUT');
    assert.equal(result.totalCost, null);
  });
}
for (const bad of [null, undefined, 'M7', [], 3, false]) {
  test(`malformed decision ${String(bad)} is safe`, () => {
    const input: unknown[] = example();
    input[1] = bad;
    const result = expectCode(input, 'INVALID_DECISION');
    assert.equal(result.totalCost, null);
  });
}
test('sparse arrays cannot bypass element validation', () => {
  const input: unknown[] = example();
  delete input[1];
  expectCode(input, 'INVALID_DECISION');
  const result = validateScenario(new Array(5));
  assert.equal(result.errorDetails.filter(error => error.code === 'INVALID_DECISION').length, 5);
});
test('unknown and prototype-like measure IDs never become catalog entries', () => {
  for (const measureId of ['M99', '__proto__', 'constructor', 'toString']) {
    const input = example();
    input[0] = d(measureId, 'nura');
    const result = expectCode(input, 'UNKNOWN_MEASURE');
    assert.equal(result.totalCost, null);
    assert.equal(result.remainingBudget, null);
  }
});
