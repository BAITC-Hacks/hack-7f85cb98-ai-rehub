import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { DISTRICTS } from '../../src/data/districts.ts';
import { MEASURES } from '../../src/data/measures.ts';
import { EXAMPLE_DECISIONS, SECOND_EXAMPLE_DECISIONS } from '../../src/data/rules.ts';
import { evaluateScenario } from '../../src/domain/evaluateScenario.ts';
import { findBestReplacement } from '../../src/domain/findBestReplacement.ts';
import { validateScenario } from '../../src/domain/validateScenario.ts';
import type {
  AdvisorResult,
  Decision,
  ReplacementCandidate,
  ValidScenarioResult,
} from '../../src/types/simulation.ts';

const clone = (decisions: readonly Decision[]): Decision[] =>
  decisions.map(item => item.districtId === undefined
    ? { measureId: item.measureId }
    : { measureId: item.measureId, districtId: item.districtId });

const keyOf = (decisions: readonly Decision[]): string =>
  decisions.map(item => `${item.measureId}:${item.districtId ?? ''}`).sort().join('|');

function currentAndCandidates(input: readonly Decision[]) {
  const initial = evaluateScenario(input);
  assert.equal(initial.valid, true);
  if (!initial.valid) throw new Error('The test scenario must be valid');
  const selected = new Set(input.map(item => item.measureId));
  const candidates = new Map<string, { decisions: Decision[]; result: ValidScenarioResult; removed: Decision; added: Decision; lag: number }>();
  let considered = 0;
  // Test-only exhaustive cross product: replacement first, location second, removed ID last.
  // It does not call the advisor's candidate generator or use its returned candidates.
  for (const measure of MEASURES.filter(item => !selected.has(item.id))) {
    for (const location of measure.scope === 'city' ? [undefined] : DISTRICTS.map(item => item.id)) {
      const added: Decision = location === undefined
        ? { measureId: measure.id }
        : { measureId: measure.id, districtId: location };
      for (const removed of input) {
        const decisions = [...clone(input).filter(item => item.measureId !== removed.measureId), added];
        considered += 1;
        if (!validateScenario(decisions).valid) continue;
        const result = evaluateScenario(decisions);
        if (!result.valid) continue;
        candidates.set(keyOf(decisions), { decisions, result, removed, added, lag: measure.lagQuarters });
      }
    }
  }
  return { initial, candidates, considered };
}

const ascii = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

function independentlyRank(input: readonly Decision[]) {
  const { initial, candidates, considered } = currentAndCandidates(input);
  const list = [...candidates].map(([key, item]) => ({ key, ...item }));
  const score = [...list].sort((a, b) =>
    b.result.finalScore - a.result.finalScore ||
    a.result.criticalAfter - b.result.criticalAfter || ascii(a.key, b.key));
  const weakest = [...list].sort((a, b) =>
    (b.result.weakestDistrictScoreAfter - initial.weakestDistrictScoreAfter) -
    (a.result.weakestDistrictScoreAfter - initial.weakestDistrictScoreAfter) ||
    b.result.finalScore - a.result.finalScore || ascii(a.key, b.key));
  const fast = [...list].sort((a, b) =>
    a.lag - b.lag || b.result.finalScore - a.result.finalScore || ascii(a.key, b.key));
  return { initial, candidates, considered, score, weakest, fast };
}

function winners(result: AdvisorResult): ReplacementCandidate[] {
  return [...result.topAlternatives,
    ...[result.bestByScore, result.bestForWeakestDistrict, result.bestFastImpact]
      .filter((item): item is ReplacementCandidate => item !== undefined)];
}

function assertCandidate(candidate: ReplacementCandidate, input: readonly Decision[], current: ValidScenarioResult) {
  assert.notEqual(candidate.key, keyOf(input));
  assert.equal(candidate.decisions.length, 5);
  assert.equal(candidate.key, keyOf(candidate.decisions));
  assert.deepEqual(candidate.decisions.map(item => `${item.measureId}:${item.districtId ?? ''}`),
    [...candidate.decisions.map(item => `${item.measureId}:${item.districtId ?? ''}`)].sort());
  const before = new Set(input.map(item => item.measureId));
  const after = new Set(candidate.decisions.map(item => item.measureId));
  const removed = [...before].filter(id => !after.has(id));
  const added = [...after].filter(id => !before.has(id));
  assert.deepEqual(removed, [candidate.removed.decision.measureId]);
  assert.deepEqual(added, [candidate.added.decision.measureId]);
  for (const original of input.filter(item => item.measureId !== removed[0])) {
    assert.ok(candidate.decisions.some(item =>
      item.measureId === original.measureId && item.districtId === original.districtId));
  }
  assert.equal(validateScenario(candidate.decisions).valid, true);
  assert.deepEqual(evaluateScenario(candidate.decisions), candidate.result);
  assert.equal(candidate.scoreGain, candidate.result.finalScore - current.finalScore);
  assert.equal(candidate.weakestDistrictGain,
    candidate.result.weakestDistrictScoreAfter - current.weakestDistrictScoreAfter);
  assert.equal(candidate.removedCriticalCount, current.criticalAfter - candidate.result.criticalAfter);
  assert.equal(candidate.result.weakestDistrictScoreAfter,
    Math.min(...candidate.result.districts.map(item => item.scoreAfter)));
  assert.equal(candidate.addedLagQuarters,
    MEASURES.find(item => item.id === candidate.added.decision.measureId)?.lagQuarters);
}

test('integration: exhaustive independent enumeration matches all rankings and counters', () => {
  const input = clone(EXAMPLE_DECISIONS);
  const expected = independentlyRank(input);
  const actual = findBestReplacement(input);
  assert.equal(actual.current.valid, true);
  if (!actual.current.valid) throw new Error('Expected valid current scenario');
  assert.deepEqual(actual.current, expected.initial);
  assert.equal(actual.evaluatedCandidates, expected.considered);
  assert.equal(actual.validCandidates, expected.candidates.size);
  assert.deepEqual(actual.topAlternatives.map(item => item.key), expected.score.slice(0, 3).map(item => item.key));
  assert.equal(actual.bestByScore?.key, expected.score[0]?.key);
  assert.equal(actual.bestForWeakestDistrict?.key, expected.weakest[0]?.key);
  assert.equal(actual.bestFastImpact?.key, expected.fast[0]?.key);
  assert.equal(new Set(actual.topAlternatives.map(item => item.key)).size, actual.topAlternatives.length);
  for (const candidate of winners(actual)) assertCandidate(candidate, input, actual.current);
  assert.ok(actual.evaluatedCandidates <= 225);
});

test('integration: a valid local optimum still returns negative-gain replacements', () => {
  const input = clone(SECOND_EXAMPLE_DECISIONS);
  const expected = independentlyRank(input);
  const actual = findBestReplacement(input);
  assert.equal(actual.current.valid, true);
  if (!actual.current.valid) throw new Error('Expected valid current scenario');
  assert.ok(actual.validCandidates > 0);
  assert.equal(actual.validCandidates, expected.candidates.size);
  assert.equal(actual.evaluatedCandidates, expected.considered);
  assert.deepEqual(actual.topAlternatives.map(item => item.key), expected.score.slice(0, 3).map(item => item.key));
  assert.equal(actual.bestByScore?.key, expected.score[0]?.key);
  assert.equal(actual.bestForWeakestDistrict?.key, expected.weakest[0]?.key);
  assert.equal(actual.bestFastImpact?.key, expected.fast[0]?.key);
  assert.ok(actual.bestByScore && actual.bestByScore.scoreGain < 0);
  assert.ok(actual.bestFastImpact && actual.bestFastImpact.scoreGain < actual.bestByScore.scoreGain);
  assert.equal(actual.bestByScore.key, actual.bestForWeakestDistrict?.key);
  for (const candidate of winners(actual)) assertCandidate(candidate, input, actual.current);
});

test('input order does not change selected scenario keys or scores', () => {
  const input = clone(EXAMPLE_DECISIONS);
  const variants = [input, [...input].reverse(), [input[3]!, input[0]!, input[4]!, input[2]!, input[1]!]];
  const summaries = variants.map(variant => {
    const result = findBestReplacement(variant);
    return {
      top: result.topAlternatives.map(item => [item.key, item.result.finalScore]),
      score: result.bestByScore?.key,
      weakest: result.bestForWeakestDistrict?.key,
      fast: result.bestFastImpact?.key,
      considered: result.evaluatedCandidates,
      valid: result.validCandidates,
    };
  });
  assert.deepEqual(summaries[1], summaries[0]);
  assert.deepEqual(summaries[2], summaries[0]);
});

test('frozen input is unchanged and repeated calls are deterministic', () => {
  const input = clone(EXAMPLE_DECISIONS);
  const snapshot = structuredClone(input);
  for (const item of input) Object.freeze(item);
  Object.freeze(input);
  const first = findBestReplacement(input);
  const second = findBestReplacement(input);
  assert.deepEqual(input, snapshot);
  assert.deepEqual(second, first);
});

test('invalid input returns the evaluator errors, no candidates and no winners', () => {
  const input = clone(EXAMPLE_DECISIONS);
  input[1] = { measureId: input[0]!.measureId, districtId: 'almaty' };
  const validation = validateScenario(input);
  assert.equal(validation.valid, false);
  const expected = evaluateScenario(input);
  const actual = findBestReplacement(input);
  assert.deepEqual(actual.current, expected);
  assert.deepEqual(actual.current.errors, validation.errors);
  assert.deepEqual(actual.topAlternatives, []);
  assert.equal(actual.evaluatedCandidates, 0);
  assert.equal(actual.validCandidates, 0);
  assert.equal(actual.bestByScore, undefined);
  assert.equal(actual.bestForWeakestDistrict, undefined);
  assert.equal(actual.bestFastImpact, undefined);
});

function runIsolatedFixture(mode: 'none' | 'negative' | 'ties') {
  const advisorUrl = new URL('../../src/domain/findBestReplacement.ts', import.meta.url).href;
  const script = `
    import { registerHooks } from 'node:module';
    const mode = ${JSON.stringify(mode)};
    const originals = ['M1','M2','M3','M4','M5'];
    const modules = new Map([
      ['../data/districts.ts', "export const DISTRICTS = [{id:'nura',name:'Nura'}];"],
      ['../data/measures.ts', "export const MEASURES = ['M1','M2','M3','M4','M5','M6'].map(id => ({id,name:id,scope:'city',lagQuarters:1}));"],
      ['./validateScenario.ts', \`export function validateScenario(input) {
        const replacement = input.some(item => item.measureId === 'M6');
        if (\${JSON.stringify(mode)} === 'none' && replacement) return {valid:false,errors:['fixture'],decisions:[]};
        return {valid:true,errors:[],decisions:input.map(item => ({measureId:item.measureId}))};
      }\`],
      ['./evaluateScenario.ts', \`export function evaluateScenario(input) {
        const removed = ['M1','M2','M3','M4','M5'].find(id => !input.some(item => item.measureId === id));
        const score = removed ? (\${JSON.stringify(mode)} === 'ties' ? 90 : 94 + Number(removed.slice(1))) : 100;
        return {valid:true,finalScore:score,weakestDistrictScoreAfter:score,criticalAfter:removed ? 2 : 0};
      }\`],
    ]);
    registerHooks({resolve(specifier, context, nextResolve) {
      const code = modules.get(specifier);
      return code ? {url:'data:text/javascript,' + encodeURIComponent(code),shortCircuit:true} : nextResolve(specifier,context);
    }});
    const {findBestReplacement} = await import(${JSON.stringify(advisorUrl)});
    const result = findBestReplacement(originals.map(measureId => ({measureId})));
    console.log(JSON.stringify({
      evaluated:result.evaluatedCandidates, valid:result.validCandidates,
      top:result.topAlternatives.map(item => [item.key,item.scoreGain,item.removedCriticalCount]),
      score:result.bestByScore?.key,
      weakest:result.bestForWeakestDistrict?.key,
      fast:result.bestFastImpact?.key,
    }));
  `;
  const run = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script],
    { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout.trim()) as {
    evaluated: number; valid: number; top: [string, number, number][];
    score?: string; weakest?: string; fast?: string;
  };
}

test('test-only fixture: no admissible candidate leaves winners absent', () => {
  const result = runIsolatedFixture('none');
  assert.equal(result.evaluated, 5);
  assert.equal(result.valid, 0);
  assert.deepEqual(result.top, []);
  assert.equal(result.score, undefined);
  assert.equal(result.weakest, undefined);
  assert.equal(result.fast, undefined);
});

test('test-only fixture: negative gains and increased critical count remain signed; winners may coincide', () => {
  const result = runIsolatedFixture('negative');
  assert.equal(result.evaluated, 5);
  assert.equal(result.valid, 5);
  assert.equal(result.top.length, 3);
  assert.ok(result.top.every(([, gain, critical]) => gain < 0 && critical === -2));
  assert.equal(result.score, result.weakest);
  assert.equal(result.score, result.fast);
});

test('test-only fixture: exact ties use ASCII canonical key for all strategies', () => {
  const result = runIsolatedFixture('ties');
  assert.equal(result.valid, 5);
  const ordered = [...result.top.map(item => item[0])];
  assert.deepEqual(ordered, [...ordered].sort());
  assert.equal(result.score, ordered[0]);
  assert.equal(result.weakest, ordered[0]);
  assert.equal(result.fast, ordered[0]);
});
