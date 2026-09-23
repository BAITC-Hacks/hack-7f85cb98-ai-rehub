import type { AdvisorResult, InvalidScenarioResult, ScenarioResult, ValidScenarioResult } from '../src/types/simulation.ts';
export function inspectScenario(result: ScenarioResult): number | null {
  if (result.valid) {
    const valid: ValidScenarioResult = result;
    return valid.finalScore;
  }
  const invalid: InvalidScenarioResult = result;
  const missing: null = invalid.finalScore;
  return missing;
}
export function inspectAdvisor(result: AdvisorResult): number | undefined {
  return result.bestByScore?.result.finalScore;
}
