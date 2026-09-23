import { createFallbackAnalysis } from "@/lib/ai/fallbackAnalysis";
import { analysisResponseSchema } from "@/lib/ai/schemas";
import type { ReplacementCandidate, ScenarioAnalysis, ScenarioResult } from "@/types/simulation";

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
  const local = () => createFallbackAnalysis(scenario, candidate);

  try {
    const response = await (options.fetcher ?? fetch)("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario, candidate }),
      signal: options.signal,
    });
    if (!response.ok) throw new Error("analysis request failed");

    const parsed = analysisResponseSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error("invalid analysis response");
    return { analysis: parsed.data, error: null };
  } catch (error) {
    if (options.signal?.aborted) throw error;
    return {
      analysis: local(),
      error: "Расширенный анализ недоступен. Показан локальный разбор результатов.",
    };
  }
}
