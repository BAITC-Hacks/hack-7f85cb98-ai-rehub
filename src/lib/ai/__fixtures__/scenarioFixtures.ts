import { toAnalysisScenario, toReplacementCandidate } from "@/lib/ai/engineScenario";
import { EXAMPLE_DECISIONS, evaluateScenario } from "@/domain";

const current = evaluateScenario(EXAMPLE_DECISIONS);
const replacementDecisions = [
  ...EXAMPLE_DECISIONS.filter(({ measureId }) => measureId !== "M5"),
  { measureId: "M3", districtId: "nura" } as const,
];
const replacement = evaluateScenario(replacementDecisions);

if (!current.valid || !replacement.valid) {
  throw new Error("Тестовые сценарии должны проходить проверку движка");
}

const candidate = toReplacementCandidate(
  EXAMPLE_DECISIONS,
  current,
  replacementDecisions,
  replacement,
);
if (!candidate) throw new Error("Тестовая замена должна улучшать результат");

export const currentScenarioFixture = toAnalysisScenario(current);
export const replacementScenarioFixture = toAnalysisScenario(replacement);
export const replacementCandidateFixture = candidate;
