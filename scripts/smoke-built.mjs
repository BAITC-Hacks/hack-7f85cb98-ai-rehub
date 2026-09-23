import assert from 'node:assert/strict';
import {getBaseline, evaluateScenario, findBestReplacement, EXAMPLE_DECISIONS,
  SECOND_EXAMPLE_DECISIONS} from '../dist/engine/domain/index.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8);
close(getBaseline().score,52.55768);
close(evaluateScenario(EXAMPLE_DECISIONS).finalScore,56.54307);
close(evaluateScenario(SECOND_EXAMPLE_DECISIONS).finalScore,57.236735);
const advisor=findBestReplacement(EXAMPLE_DECISIONS);
assert.equal(advisor.topAlternatives.length,3);
assert.ok(advisor.topAlternatives.every(c=>c.result.valid));
console.log(JSON.stringify({status:'PASS',runtime:'compiled ESM',score:evaluateScenario(EXAMPLE_DECISIONS).finalScore,
  topKeys:advisor.topAlternatives.map(c=>c.key)}));
