/** Pure browser/server public API. No Node or provider SDK dependencies. */
export {validateScenario} from './validateScenario.ts';
export {evaluateScenario, getBaseline} from './evaluateScenario.ts';
export {findBestReplacement} from './findBestReplacement.ts';
export {DISTRICTS} from '../data/districts.ts';
export {MEASURES} from '../data/measures.ts';
export {MODEL_VERSION, RULES, CATEGORIES, INDICATORS, SYNERGIES, INCOMPATIBILITIES,
  EXAMPLE_DECISIONS, SECOND_EXAMPLE_DECISIONS} from '../data/rules.ts';
export type * from '../types/simulation.ts';
