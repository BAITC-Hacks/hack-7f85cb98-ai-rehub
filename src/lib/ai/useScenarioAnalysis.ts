"use client";

import { useEffect, useState } from "react";

import { requestScenarioAnalysis } from "@/lib/ai/requestScenarioAnalysis";
import type { ReplacementCandidate, ScenarioAnalysis, ScenarioResult } from "@/types/simulation";

type AnalysisState = {
  key: string | null;
  analysis: ScenarioAnalysis | null;
  loading: boolean;
  error: string | null;
};

export function useScenarioAnalysis(
  scenario: ScenarioResult | null,
  candidate?: ReplacementCandidate,
) {
  const [retryIndex, setRetryIndex] = useState(0);
  const [state, setState] = useState<AnalysisState>({
    key: null,
    analysis: null,
    loading: false,
    error: null,
  });
  const requestKey = scenario ? JSON.stringify({ scenario, candidate, retryIndex }) : null;

  useEffect(() => {
    if (!requestKey) return;
    const controller = new AbortController();
    const { scenario: currentScenario, candidate: currentCandidate } = JSON.parse(requestKey) as {
      scenario: ScenarioResult;
      candidate?: ReplacementCandidate;
    };

    requestScenarioAnalysis(currentScenario, currentCandidate, { signal: controller.signal })
      .then(({ analysis, error }) => {
        if (!controller.signal.aborted) setState({ key: requestKey, analysis, error, loading: false });
      })
      .catch(() => {
        // Aborted requests belong to an older scenario.
      });

    return () => controller.abort();
  }, [requestKey]);

  // A changed scenario must never display the previous scenario's explanation.
  const visibleState = state.key === requestKey
    ? state
    : { analysis: null, loading: Boolean(scenario), error: null };

  return {
    analysis: visibleState.analysis,
    loading: visibleState.loading,
    error: visibleState.error,
    retry: () => setRetryIndex((value) => value + 1),
  };
}
