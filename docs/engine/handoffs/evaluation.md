# ENGINE-EVALUATION handoff

- BASE_SHA: `2c6a2e745f8fb512f901ed4f3a4440fcea255bc9`
- Branch: `feature/engine-evaluation`
- Code commit: `33776e3ca92f9a84e107f19b34d9a6ce21b08196`
- Changed code/test files: `src/domain/evaluateScenario.ts`, `src/domain/indicatorMath.ts`, `tests/engine/evaluation.test.ts`
- Exported functions: `evaluateScenario(input: unknown): ScenarioResult`, `getBaseline(): BaselineResult`, `clip`, `applyIndicatorEffects`, `calculateDistrictScore`, `countCriticalIndicators`, `evaluateIndicators`.

## Results

The evaluator imports canonical `DISTRICTS`, `MEASURES`, `INDICATORS`, `RULES`, `SYNERGIES`, and the shared `validateScenario`. City effects reach five districts while their cost is counted once by the validator. Effects use `(8 - lag) / 8`; fixed synergies are added without lag; each indicator is clipped once after summation. District and city scores use canonical weights, population shares and a strict `< 40` threshold. No score or intermediate value is rounded.

`getBaseline()` returns baseline score `52.55768` (within `1e-8`; binary floating point may serialize as `52.557680000000005`), city average `56.8624`, and two critical indicators. The example costing 95 returns `56.54307`; the example costing 98 returns `57.236735`, both within `1e-8`. An invalid selection has `finalScore: null`, `scoreDelta: null`, and no calculated districts; baseline facts remain available. `[]` is invalid.

Contributions expose `fullEffects`, `realizedEffects`, and the observed total scenario delta for each affected indicator in each target district. The observed delta includes other measures, synergy and clipping; it is **not** an additive per-measure contribution to the nonlinear official Score. Synergies are listed separately.

Example calls:

```ts
evaluateScenario([
  { measureId: 'M7', districtId: 'nura' },
  { measureId: 'M8', districtId: 'nura' },
  { measureId: 'M10', districtId: 'nura' },
  { measureId: 'M12' },
  { measureId: 'M5', districtId: 'saryarka' },
]); // valid:true, totalCost:95, finalScore≈56.54307
evaluateScenario([]); // valid:false, finalScore:null
```

## Verification

Local read-only copies of DATA SHA `ec9f97a10559fea9b24681661b849d18662598a2` and VALIDATION SHA `e1781a3b24c2597ee20c2e5bf5fe953ed33421a6` were used only to run this role's tests. They are **not** part of the evaluation branch commit.

- Bundled Node 24.19.0: `node scripts/test-engine.mjs tests/engine/evaluation.test.ts` — 13/13 passed, including all 120 permutations of one example.
- TypeScript 5.9.3: `tsc --noEmit -p tsconfig.engine.json` — passed with those dependency copies.
- `node --test engine/test/*.test.mjs` — reference suite 74/74 passed; this does not replace new TS test evidence.
- Remote branch commit and code blob SHAs verified after publication.

Known limit: module checks above used published dependency files in a separate local snapshot. Integration in `feature/simulation-engine` awaits the main session's data → validation → evaluation merge and final full-suite run. This branch has no UI, API or LLM integration by design.
