import {writeFileSync} from 'node:fs';
writeFileSync('dist/smoke.html', `<!doctype html><html lang="ru"><meta charset="utf-8"><title>Engine browser smoke</title><body><h1>Browser engine smoke</h1><pre id="result">RUNNING</pre><script type="module">
import {getBaseline,evaluateScenario,findBestReplacement,EXAMPLE_DECISIONS,SECOND_EXAMPLE_DECISIONS} from './engine/domain/index.js';
try {
 const check=(x,y)=>{if(Math.abs(x-y)>1e-8)throw new Error(x+' != '+y);};
 const baseline=getBaseline(),first=evaluateScenario(EXAMPLE_DECISIONS),second=evaluateScenario(SECOND_EXAMPLE_DECISIONS);
 check(baseline.score,52.55768);check(first.finalScore,56.54307);check(second.finalScore,57.236735);
 const advisor=findBestReplacement(EXAMPLE_DECISIONS);
 if(advisor.topAlternatives.length!==3||!advisor.topAlternatives.every(c=>c.result.valid))throw new Error('Invalid advisor result');
 document.getElementById('result').textContent=JSON.stringify({status:'PASS',baseline:baseline.score,first:first.finalScore,second:second.finalScore,rawCandidates:advisor.evaluatedCandidates,validCandidates:advisor.validCandidates,bestScore:advisor.bestByScore.result.finalScore},null,2);
} catch(error) {document.getElementById('result').textContent='FAIL: '+error.message;throw error;}
</script></body></html>`);
