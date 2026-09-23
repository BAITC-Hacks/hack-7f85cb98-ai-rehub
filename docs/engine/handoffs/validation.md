# ENGINE-VALIDATION handoff

- BASE_SHA: `2c6a2e745f8fb512f901ed4f3a4440fcea255bc9`
- Branch: `feature/engine-validation`
- Code commits: `e1781a3b24c2597ee20c2e5bf5fe953ed33421a6`, `d3ba3e546feee4ef2987a63d44a2c68b4e897a72`.
- Changed files: `src/domain/validateScenario.ts`, `tests/engine/validation.test.ts`, this handoff.
- Export: `validateScenario(input: unknown): ValidationResult`.

The function uses canonical `DISTRICTS`, `MEASURES`, `CATEGORIES`, `INCOMPATIBILITIES`, and `RULES`. It never trusts client prices or effects. Invalid entries with unknown prices yield `totalCost: null` and `remainingBudget: null`; all determinable errors are reported. Only valid input yields a new, canonically sorted decisions array. Baseline remains separate.

## Checks

- Source catalog for local module verification: `feature/engine-data` at `ec9f97a10559fea9b24681661b849d18662598a2` (the catalog files were copied into the isolated local verification directory, not committed to this branch).
- `node_modules/.bin/tsc --noEmit -p tsconfig.engine.json`: passed.
- `node scripts/test-engine.mjs tests/engine/validation.test.ts`: 42 passed, 0 failed.
- Cases: 0/4/5/6 decisions, exact and exceeded budget, category limit, global duplicate, district rules including owned undefined/null for city, all conflicts in both orders, allowed cross-district pairs, combined errors, order invariance, sparse and malformed input, catalog cost integrity, and caller immutability. The follow-up regression confirms that a duplicated local measure still reports a certain conflict when any selected known district matches, without inventing conflicts for unknown districts.

Module verification completed against the published DATA catalog. Integration verification awaits the main session merging DATA and this branch into `feature/simulation-engine`, then running its shared tests. No Score calculation or UI/API changes are included.

The local shell Git credential cannot read the private repository; remote history and branch ref were preserved and verified through the connected GitHub tool. No force push was used.
