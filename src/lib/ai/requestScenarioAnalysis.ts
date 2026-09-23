import { evaluateScenario } from "@/domain";
import { createFallbackAnalysis } from "@/lib/ai/fallbackAnalysis";
import { decisionsFromAnalysis, toReplacementCandidate } from "@/lib/ai/engineScenario";
import { analysisResponseSchema } from "@/lib/ai/schemas";
import type { ReplacementCandidate, ScenarioAnalysis, ScenarioResult } from "@/types/simulation";

export type AnalysisOutcome = {
  analysis: ScenarioAnalysis;
  error: string | null;
  errorKind: "validation" | "unavailable" | null;
};
type Options = { signal?: AbortSignal; fetcher?: typeof fetch };

export async function requestScenarioAnalysis(
  scenario: ScenarioResult,
  candidate?: ReplacementCandidate,
  options: Options = {},
): Promise<AnalysisOutcome> {
  options.signal?.throwIfAborted();
  if (!scenario.valid) {
    return {
      analysis: createFallbackAnalysis(scenario),
      error: scenario.errors.join(" "),
      errorKind: "validation",
    };
  }
  const decisions = decisionsFromAnalysis(scenario);
  const localScenario = evaluateScenario(decisions);
  if (!localScenario.valid) {
    return {
      analysis: createFallbackAnalysis(localScenario),
      error: localScenario.errors.join(" "),
      errorKind: "validation",
    };
  }

  let localCandidate: ReplacementCandidate | undefined;
  let replacementDecisions;
  if (candidate) {
    replacementDecisions = decisionsFromAnalysis(candidate.result);
    const replacement = evaluateScenario(replacementDecisions);
    localCandidate = replacement.valid
      ? toReplacementCandidate(decisions, localScenario, replacementDecisions, replacement) ?? undefined
      : undefined;
    if (!localCandidate) {
      return {
        analysis: createFallbackAnalysis(localScenario),
        error: replacement.valid
          ? "Замена должна менять ровно одну меру на новую, отсутствующую в исходном плане."
          : replacement.errors.join(" "),
        errorKind: "validation",
      };
    }
  }

  try {
    const response = await (options.fetcher ?? fetch)("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decisions, replacementDecisions }),
      signal: options.signal,
    });
    options.signal?.throwIfAborted();
    if (response.status === 400) {
      const body = await response.json();
      return {
        analysis: createFallbackAnalysis(localScenario),
        error: typeof body.error === "string" ? body.error : "Проверьте выбранные решения.",
        errorKind: "validation",
      };
    }
    if (!response.ok) throw new Error("analysis request failed");
    const parsed = analysisResponseSchema.safeParse(await response.json());
    options.signal?.throwIfAborted();
    if (!parsed.success) throw new Error("invalid analysis response");
    return { analysis: parsed.data, error: null, errorKind: null };
  } catch (error) {
    if (options.signal?.aborted) throw error;
    return {
      analysis: createFallbackAnalysis(localScenario, localCandidate),
      error: "Расширенный анализ недоступен. Показан локальный разбор результатов.",
      errorKind: "unavailable",
    };
  }
}
