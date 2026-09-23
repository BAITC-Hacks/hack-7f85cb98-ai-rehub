# ENGINE-DATA handoff

- **BASE_SHA:** `2c6a2e745f8fb512f901ed4f3a4440fcea255bc9`
- **Branch:** `feature/engine-data`
- **Code commit:** `ec9f97a10559fea9b24681661b849d18662598a2`
- **Role files:** `src/data/districts.ts`, `src/data/measures.ts`, `src/data/rules.ts`, `tests/engine/data.test.ts`
- **Exports:** `DISTRICTS`, `MEASURES`, `MODEL_VERSION`, `RULES`, `CATEGORIES`, `INDICATORS`, `SYNERGIES`, `INCOMPATIBILITIES`, `EXAMPLE_DECISIONS`, `SECOND_EXAMPLE_DECISIONS`. `deepFreezeCatalog` is shared by the three data modules to recursively freeze their private catalog literals.

## Verification

Checks ran in an isolated local copy of the starter snapshot because shell Git authentication is unavailable. The private branch was created and its commits were written through the connected GitHub tool.

- `node scripts/test-engine.mjs tests/engine/data.test.ts` — 4/4 tests passed.
- `node --test engine/test/*.test.mjs` — 74/74 legacy reference tests passed.
- Strict TypeScript 5.9.3 check with the starter `tsconfig.engine.json` and the bundled `@types/node` — passed. The host has no `npm` command on PATH, so the equivalent compiler invocation was used instead of `npm run typecheck:engine`.
- Independent baseline calculation in the new test: district scores `62.99`, `57.06`, `54.65`, `56.63`, `49.18`; population-weighted average `56.8624`; 2 critical indicators; Score `52.55768`.

## Notes and limitations

- Catalog IDs, names, all district values and shares, all indicator weights, measure costs/lags/scopes/effects, synergies, incompatibilities, and both example decision sets are checked against independently transcribed source fixtures. M11 keeps its negative `T1: -2`; values E2 and T1 are not inverted again.
- Recursive runtime freezing protects nested objects and arrays; mutation tests confirm attempted changes throw and leave catalog values intact.
- The source's “cheapest set costs 61” statement names measures but omits district assignments required by M4, M9, M10, and M11. A complete minimality proof is not supplied by that sentence; this role adds no optimizer. The stated measure set is cost 61 and fits the category/global-conflict rules when its local measures receive districts.
- Module tests and typecheck passed. Integration remains pending the main branch's merge of this data branch and the other role modules; this handoff does not claim integrated verification.
