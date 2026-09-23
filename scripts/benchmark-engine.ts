import {performance} from 'node:perf_hooks';
import {findBestReplacement} from '../src/domain/findBestReplacement.ts';
import {EXAMPLE_DECISIONS, SECOND_EXAMPLE_DECISIONS} from '../src/data/rules.ts';
const report=[];
for (const [label, decisions] of [['first',EXAMPLE_DECISIONS],['second',SECOND_EXAMPLE_DECISIONS]] as const) {
  const durations=[];
  let last;
  for (let i=0; i<11; i++) {
    const start=performance.now();
    last=findBestReplacement(decisions);
    const elapsed=performance.now()-start;
    if(i>0)durations.push(elapsed);
  }
  durations.sort((a,b)=>a-b);
  report.push({scenario:label,rawCandidates:last!.evaluatedCandidates,validCandidates:last!.validCandidates,
    minMs:durations[0],medianMs:(durations[4]!+durations[5]!)/2,maxMs:durations[9],bestScore:last!.bestByScore?.result.finalScore});
}
console.log(JSON.stringify({node:process.version,platform:process.platform,arch:process.arch,runs:10,report},null,2));
