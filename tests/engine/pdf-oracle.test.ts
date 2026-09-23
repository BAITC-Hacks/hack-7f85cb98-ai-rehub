import assert from 'node:assert/strict';
import test from 'node:test';
import { DISTRICTS, MEASURES, INDICATORS, evaluateScenario, getBaseline, findBestReplacement } from '../../src/domain/index.ts';
import type { Decision } from '../../src/types/simulation.ts';

// Independent transcription of the original Датасет районов.pdf, visually
// checked against pages 1–5. This oracle does not use production calculation,
// validation, or catalog values. All math uses integer eighths / percentages.
const codes = ['T1','T2','E1','E2','S1','S2','B1','B2','C1','C2'] as const;
const places = ['yesil','almaty','saryarka','baikonur','nura'];
const weights = [10,10,9,11,11,11,9,9,10,10];
const population = [27,24,20,13,16];
const base = [
 [45,62,68,72,48,55,78,60,75,70], [40,75,50,55,60,65,62,52,50,60],
 [50,70,42,40,62,68,58,55,45,55], [52,68,55,50,58,60,52,58,55,58],
 [55,40,45,65,38,35,55,50,60,50],
];
// category, city(1)/district(0), cost, lag, full indicator effects.
const raw: [number,number,number,number,Partial<Record<typeof codes[number],number>>][] = [
 [0,0,18,2,{T1:6,T2:9}], [0,1,22,2,{T1:4,B2:3}], [0,0,30,4,{T1:16,T2:20,E2:4}],
 [1,0,15,2,{E1:12,E2:3,B1:2}], [1,0,25,3,{E2:14,C1:4}], [1,1,20,4,{E1:5,E2:3}],
 [2,0,24,3,{S1:16}], [2,0,20,3,{S2:14}], [2,0,10,1,{S1:3,S2:3,B1:3}],
 [3,0,12,1,{B1:12,B2:2}], [3,0,10,1,{B2:12,T1:-2}], [4,1,14,1,{C2:5}],
 [4,0,28,4,{C1:18,E2:2}], [4,1,16,1,{C1:5,C2:2}],
];
const source = raw.map(([category,city,cost,lag,effects],i)=>({id:'M'+(i+1),category,city,cost,lag,effects}));
const lookup = new Map(source.map(m=>[m.id,m]));
const bonuses = [['M1','M2','T1'],['M10','M12','B1'],['M5','M6','E2']] as const;
const key = (plan: readonly Decision[]) => plan.map(d=>d.measureId+':'+(d.districtId??'')).sort().join('|');
const close = (a:number,b:number) => assert.ok(Math.abs(a-b)<1e-10, String(a)+' != '+b);
function permitted(plan: readonly Decision[]) {
 if(plan.length!==5 || new Set(plan.map(d=>d.measureId)).size!==5) return false;
 const categories=[0,0,0,0,0]; let cost=0;
 for(const d of plan) {
  const m=lookup.get(d.measureId); if(!m) return false;
  if(Object.keys(d).some(k=>k!=='measureId'&&k!=='districtId')) return false;
  if(m.city ? Object.hasOwn(d,'districtId') : !places.includes(d.districtId??'')) return false;
  categories[m.category]++; cost+=m.cost;
 }
 if(cost>100 || categories.some(n=>n>2)) return false;
 const selected=new Map(plan.map(d=>[d.measureId,d]));
 if(selected.has('M1')&&selected.has('M3')) return false;
 for(const [a,b] of [['M4','M7'],['M5','M13']])
  if(selected.has(a)&&selected.has(b)&&selected.get(a)!.districtId===selected.get(b)!.districtId) return false;
 return true;
}
function oracle(plan: readonly Decision[]) {
 const values=base.map(row=>row.map(n=>n*8)); let cost=0;
 for(const d of plan) {
  const m=lookup.get(d.measureId)!; cost+=m.cost;
  for(let i=0;i<5;i++) if(m.city||d.districtId===places[i])
   for(let k=0;k<10;k++) values[i][k]+=(m.effects[codes[k]]??0)*(8-m.lag);
 }
 const active:string[]=[];
 for(const [a,b,k] of bonuses) {
  const first=plan.find(d=>d.measureId===a);
  if(first&&plan.some(d=>d.measureId===b)) {
   values[places.indexOf(first.districtId!)][codes.indexOf(k)]+=16; active.push(a+'+'+b);
  }
 }
 for(const row of values) for(let k=0;k<10;k++) row[k]=Math.min(800,Math.max(0,row[k]));
 const districts=values.map(row=>row.reduce((sum,n,k)=>sum+n*weights[k],0));
 const average=districts.reduce((sum,n,i)=>sum+n*population[i],0);
 const weakest=Math.min(...districts); const critical=values.flat().filter(n=>n<320).length;
 const score=7*average+300*weakest-800000*critical;
 assert.ok(Number.isSafeInteger(score));
 return {values,districts,average,weakest,critical,score,cost,active};
}
function choose(n:number,size:number,from=0,prefix:number[]=[]):number[][] {
 if(!size)return [prefix];
 return Array.from({length:n-from-size+1},(_,i)=>i+from).flatMap(i=>choose(n,size-1,i+1,[...prefix,i]));
}
// All 2,002 measure combinations, each with five rotating district layouts.
// This covers 10,010 cases, NOT every possible district assignment.
const matrix=choose(14,5).flatMap(ids=>places.map((_,offset)=>ids.map((id,i):Decision=>
 source[id].city ? {measureId:source[id].id} : {measureId:source[id].id,districtId:places[(i+offset)%5]})));
const official:Decision[]=[{measureId:'M7',districtId:'nura'},{measureId:'M8',districtId:'nura'},
 {measureId:'M10',districtId:'nura'},{measureId:'M12'},{measureId:'M5',districtId:'saryarka'}];
const second:Decision[]=[{measureId:'M2'},{measureId:'M3',districtId:'nura'},{measureId:'M8',districtId:'nura'},
 {measureId:'M9',districtId:'nura'},{measureId:'M14'}];
const custom:Decision[]=[{measureId:'M1',districtId:'almaty'},{measureId:'M2'},
 {measureId:'M8',districtId:'nura'},{measureId:'M11',districtId:'almaty'},{measureId:'M14'}];
const custom2:Decision[]=[{measureId:'M4',districtId:'yesil'},{measureId:'M6'},
 {measureId:'M7',districtId:'nura'},{measureId:'M10',districtId:'baikonur'},{measureId:'M12'}];

test('original PDF: numeric catalogs, district baseline and exact published controls',()=>{
 assert.deepEqual(DISTRICTS.map(d=>codes.map(k=>d.indicators[k])),base);
 assert.deepEqual(DISTRICTS.map(d=>d.populationShare*100),population);
 assert.deepEqual(INDICATORS.map(i=>i.weight*100),weights);
 const categories=['transport','ecology','social','safety','services'];
 assert.deepEqual(MEASURES.map(m=>({id:m.id,category:categories.indexOf(m.category),city:Number(m.scope==='city'),
  cost:m.cost,lag:m.lagQuarters,effects:m.effects})),source);
 const baseline=getBaseline();
 close(baseline.score,52.55768); close(baseline.cityAverage,56.8624);
 baseline.districts.forEach((d,i)=>close(d.score,[62.99,57.06,54.65,56.63,49.18][i]));
 close(oracle([]).score/800000,52.55768);
 close(oracle(official).score/800000,56.54307); close(oracle(second).score/800000,57.236735);
});

test('original PDF: independent integer oracle and validity across 10,010 plans',t=>{
 let valid=0; const coverage=new Set<string>(); const baseline=oracle([]);
 for(const plan of matrix) {
  const actual=evaluateScenario(plan); assert.equal(actual.valid,permitted(plan),key(plan));
  if(!actual.valid) {assert.equal(actual.finalScore,null);assert.equal(actual.scoreDelta,null);assert.ok(actual.errors.length);continue;}
  valid++; const expected=oracle(plan);
  assert.equal(actual.totalCost,expected.cost);assert.equal(actual.remainingBudget,100-expected.cost);
  close(actual.finalScore,expected.score/800000);close(actual.scoreDelta,(expected.score-baseline.score)/800000);
  close(actual.cityAverageAfter,expected.average/80000);close(actual.weakestDistrictScoreAfter,expected.weakest/800);
  assert.equal(actual.criticalAfter,expected.critical);assert.deepEqual(actual.activatedSynergies,expected.active);
  actual.districts.forEach((d,i)=>{
   assert.deepEqual(codes.map(k=>d.indicatorsAfter[k]),expected.values[i].map(n=>n/8));
   close(d.scoreAfter,expected.districts[i]/800);
   assert.deepEqual(codes.map(k=>d.indicatorDeltas[k]),expected.values[i].map((n,k)=>n/8-base[i][k]));
  });
  for(const c of actual.contributions) {
   const m=lookup.get(c.measureId)!;assert.equal(c.realizedFraction,(8-m.lag)/8);
   assert.deepEqual(c.realizedEffects,Object.fromEntries(Object.entries(m.effects).map(([k,v])=>[k,v*(8-m.lag)/8])));
   for(const d of c.targetDistrictIds)coverage.add(c.measureId+':'+d);
  }
 }
 assert.equal(matrix.length,10010);assert.ok(valid>3000);assert.equal(coverage.size,70);
 t.diagnostic('Independent PDF oracle: '+valid+' valid / '+(matrix.length-valid)+' invalid; all70 measure/district pairs.');
});

test('original PDF: district conflicts and malformed plans across119 boundary cases',t=>{
 let checked=0;
 for(const original of [official,second]) {
  const cases:Decision[][]=[original.slice(1),[...original,{measureId:'M14'}]];
  for(let i=0;i<5;i++) for(const item of [{measureId:'missing'},{...original[i],districtId:'missing'},
   {...original[i],districtId:''},{...original[(i+1)%5]}])cases.push(original.map((d,j)=>j===i?item:{...d}));
  for(const plan of cases){assert.equal(permitted(plan),false);assert.equal(evaluateScenario(plan).valid,false);checked++;}
 }
 for(const ids of [['M1','M3','M9','M10','M12'],['M4','M7','M9','M10','M12'],['M5','M13','M9','M11','M12']])
  for(const a of places)for(const b of places) {
   const plan=ids.map((id,i):Decision=>lookup.get(id)!.city?{measureId:id}:{measureId:id,districtId:i===1?b:a});
   assert.equal(evaluateScenario(plan).valid,ids[0]==='M1'?false:a!==b);checked++;
  }
 assert.equal(checked,119);t.diagnostic('119 malformed/local/global conflict cases.');
});

test('original PDF: advisor rankings independently reproduced on22 plans',t=>{
 const validMatrix=matrix.filter(permitted);
 const plans=[official,second,...Array.from({length:20},(_,i)=>validMatrix[Math.floor(i*validMatrix.length/20)])];
 let count=0, accepted=0;
 for(const plan of plans){
  const candidates=[];let considered=0;
  for(const m of source.filter(m=>!plan.some(d=>d.measureId===m.id)))for(const location of m.city?[undefined]:places)
   for(const removed of plan){
    considered++;const replacement=[...plan.filter(d=>d.measureId!==removed.measureId),
     location===undefined?{measureId:m.id}:{measureId:m.id,districtId:location}];
    if(permitted(replacement))candidates.push({key:key(replacement),lag:m.lag,...oracle(replacement)});
   }
  const ascii=(a:string,b:string)=>a<b?-1:a>b?1:0;
  const score=[...candidates].sort((a,b)=>b.score-a.score||a.critical-b.critical||ascii(a.key,b.key));
  const weakest=[...candidates].sort((a,b)=>b.weakest-a.weakest||b.score-a.score||ascii(a.key,b.key));
  const fastest=[...candidates].sort((a,b)=>a.lag-b.lag||b.score-a.score||ascii(a.key,b.key));
  const actual=findBestReplacement(plan);
  assert.equal(actual.evaluatedCandidates,considered);assert.equal(actual.validCandidates,candidates.length);
  assert.deepEqual(actual.topAlternatives.map(c=>c.key),score.slice(0,3).map(c=>c.key),'top3 '+key(plan));
  assert.equal(actual.bestByScore?.key,score[0]?.key,'score '+key(plan));
  assert.equal(actual.bestForWeakestDistrict?.key,weakest[0]?.key,'weakest '+key(plan));
  assert.equal(actual.bestFastImpact?.key,fastest[0]?.key,'fastest '+key(plan));
  count+=considered;accepted+=candidates.length;
 }
 t.diagnostic('Independent advisor: '+plans.length+' plans; '+count+' candidates / '+accepted+' valid.');
});

test('original PDF: two new individual plans and a district-only change',t=>{
 const changed=custom.map(d=>d.measureId==='M8'?{...d,districtId:'yesil'}:d);
 const checks=[custom,custom2,changed];
 for(const plan of checks){
  assert.equal(permitted(plan),true);const expected=oracle(plan);const actual=evaluateScenario(plan);assert.ok(actual.valid);
  close(actual.finalScore,expected.score/800000);
  t.diagnostic(JSON.stringify({plan,cost:expected.cost,score:expected.score/800000,critical:expected.critical,
   cityAverage:expected.average/80000,weakest:expected.weakest/800}));
 }
 assert.notEqual(oracle(custom).score,oracle(changed).score);
 assert.equal(oracle(custom).cost,oracle(changed).cost);
});

