import { createFallbackAnalysis } from "@/lib/ai/fallbackAnalysis";
import { decisionsFromAnalysis, toAnalysisScenario, toReplacementCandidate } from "@/lib/ai/engineScenario";
import { analysisResponseSchema } from "@/lib/ai/schemas";
import type { ReplacementCandidate, ScenarioAnalysis, ScenarioResult } from "@/types/simulation";
import { simulateScenario } from "../../../engine/index.mjs";

export type AnalysisOutcome = {
  analysis: ScenarioAnalysis;
  error: string | null;
};

type Options = {
  signal?: AbortSignal;
  fetcher?: typeof fetch;
};

export async function requestScenarioAnalysis(
  scenario: ScenarioResult,
  candidate?: ReplacementCandidate,
  options: Options = {},
): Promise<AnalysisOutcome> {
  let localScenario = scenario;
  let localCandidate: ReplacementCandidate | undefined;

  try {
    const decisions = decisionsFromAnalysis(scenario);
    const simulation = simulateScenario(decisions);
    if (!simulation.valid) throw new Error("invalid local scenario");
    localScenario = toAnalysisScenario(simulation);

    let replacementDecisions;
    if (candidate) {
      replacementDecisions = decisionsFromAnalysis(candidate.result);
      const replacement = simulateScenario(replacementDecisions);
      if (!replacement.valid) throw new Error("invalid local replacement");
      localCandidate = toReplacementCandidate(decisions, simulation, replacementDecisions, replacement) ?? undefined;
      if (!localCandidate) throw new Error("replacement does not improve the scenario");
    }

    const response = await (options.fetcher ?? fetch)("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decisions, replacementDecisions }),
      signal: options.signal,
    });
    if (!response.ok) throw new Error("analysis request failed");

    const parsed = analysisResponseSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error("invalid analysis response");
    return { analysis: parsed.data, error: null };
  } catch (error) {
    if (options.signal?.aborted) throw error;
    return {
      analysis: createFallbackAnalysis(localScenario, localCandidate),
      error: "Расширенный анализ недоступен. Показан локальный разбор результатов.",
    };
  }
}
