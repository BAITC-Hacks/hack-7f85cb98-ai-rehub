# ENGINE-ADVISOR handoff

- **BASE_SHA:** `2c6a2e745f8fb512f901ed4f3a4440fcea255bc9` (`feature/simulation-engine` starter).
- **Branch:** `feature/engine-advisor`.
- **Published code/test commits:** `ded9657117facbdc46704c2cf20a682a00e48f0b`, then `2bef47c0fe19ebcacbada99c0f76307d53aa395a` (current code head before this handoff).
- **PR:** https://github.com/BAITC-Hacks/hack-7f85cb98-ai-rehub/pull/3, targeting `feature/simulation-engine`.
- **Changed files:** `src/domain/findBestReplacement.ts`, `tests/engine/advisor.test.ts`, this handoff only.
- **Export:** `findBestReplacement(current: unknown): AdvisorResult` from `src/domain/findBestReplacement.ts`. The main integrator owns the shared `src/domain/index.ts` export.

The function validates and reevaluates the supplied decisions, then exhaustively checks one replacement using the shared catalog, validator and evaluator. It keeps all four retained decisions, including their districts. Sets and outputs use the contract's ASCII canonical key. The three strategy winners may coincide; `topAlternatives` contains up to three unique valid sets. Negative and zero gains remain visible. `evaluatedCandidates` counts all raw candidates sent to validation; `validCandidates` counts unique valid candidates.

## Checks

A separate temporary integration workspace combined the exact published source files from DATA `f7a66b9332f33f1308190016bcd22ba7c361657e`, VALIDATION `d708c5dfff1f219ae63a487609970d709c307a7e`, EVALUATION `012291464f132025e36eed7445068b92d23ad4a8`, and this branch. No other role's files were added to this branch.

- Strict TypeScript: `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.engine.json` — passed.
- Advisor: `node scripts/test-engine.mjs tests/engine/advisor.test.ts` — **8/8 passed**, including independent exhaustive enumeration, real evaluator replay, all rankings, order independence, frozen input, invalid input, a real negative-gain local optimum, and test-only no-candidate/tie fixtures.
- All role suites in that workspace: `node scripts/test-engine.mjs` — **64/64 passed**.
- Published reference: `node --test engine/test/*.test.mjs` — **74/74 passed**.

The real 98-cost example has valid replacements but no positive Score gain: the best is approximately `−0.01119`, and the fastest strategy gains approximately `−0.04827`. This is a useful UI/AI guard against calling every replacement an improvement.

## Search measurement

On this Mac with bundled Node.js 24.19.0, the 95-cost example examined **165** raw and **101** unique valid candidates. One call took **26.73 ms** on the first run; the median of 50 subsequent calls was **8.19 ms** (range 7.06–12.19 ms). This is a local measurement, not a device guarantee. The function is synchronous; invoke it on the user's “Find best replacement” action, not every render. The measured workload does not justify adding a worker or cache here.

## Dependencies and integration

- Requires the DATA catalog exports, `validateScenario` and `evaluateScenario` from their assigned modules. Neither rules nor scoring is duplicated locally.
- Module verification with those exact real implementations passed. Integration in the common `feature/simulation-engine` branch and its shared barrel is owned by the main session and remains to be verified after its merges.
- Valid example: `findBestReplacement(EXAMPLE_DECISIONS)` returns three top alternatives and strategy winners. Invalid example: duplicate `M7` in the five decisions returns evaluator errors, zero counters, `topAlternatives: []` and no winners.
- No known search correctness limitation within the frozen 14-measure catalog. The synchronous runtime is bounded by the one-replacement neighborhood; it is not a global optimizer.
