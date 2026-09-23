import { describe, expect, it, vi } from "vitest";

import { currentScenarioFixture, replacementCandidateFixture } from "@/lib/ai/__fixtures__/scenarioFixtures";
import { ANALYSIS_REQUEST_TIMEOUT_MS, requestScenarioAnalysis } from "@/lib/ai/requestScenarioAnalysis";
import { evaluateScenario, SECOND_EXAMPLE_DECISIONS, findBestReplacement } from "@/domain";

const validAnalysis = {
  source: "openai",
  summary: "Городской результат вырос.",
  strengths: ["Социальные услуги улучшились."],
  risks: ["Один район остаётся слабее."],
  tradeoffs: ["Бюджет почти исчерпан."],
  recommendations: ["Проверить замену меры."],
};

describe("requestScenarioAnalysis", () => {
  it("sends decision IDs for server recalculation and accepts a valid answer", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(validAnalysis), { status: 200 }));
    const outcome = await requestScenarioAnalysis(currentScenarioFixture, undefined, { fetcher });

    expect(outcome.analysis.source).toBe("openai");
    expect(outcome.error).toBeNull();
    expect(fetcher).toHaveBeenCalledWith("/api/analyze", expect.objectContaining({ method: "POST" }));
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body.decisions).toHaveLength(5);
    expect(body.decisions).toContainEqual({ measureId: "M12" });
    expect(body).not.toHaveProperty("scenario");
  });

  it("sends a one-decision replacement for server recalculation", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(validAnalysis), { status: 200 }));
    await requestScenarioAnalysis(currentScenarioFixture, replacementCandidateFixture, { fetcher });
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body.replacementDecisions).toContainEqual({ measureId: "M3", districtId: "nura" });
    expect(body).not.toHaveProperty("candidate");
  });

  it("keeps server fallback as a normal response", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ...validAnalysis, source: "fallback",
    }), { status: 200 }));
    const outcome = await requestScenarioAnalysis(currentScenarioFixture, undefined, { fetcher });

    expect(outcome.analysis.source).toBe("fallback");
    expect(outcome.error).toBeNull();
  });

  it("uses local fallback when the server fails", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("offline"));
    const outcome = await requestScenarioAnalysis(currentScenarioFixture, undefined, { fetcher });

    expect(outcome.analysis.source).toBe("fallback");
    expect(outcome.error).toContain("локальный");
  });

  it("recalculates a local fallback instead of trusting a supplied Score", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("offline"));
    const fakeScenario = { ...currentScenarioFixture, finalScore: 999, scoreDelta: 946 };
    const outcome = await requestScenarioAnalysis(fakeScenario, undefined, { fetcher });
    expect(outcome.analysis.source).toBe("fallback");
    expect(outcome.analysis.summary).toContain("56,54");
    expect(outcome.analysis.summary).not.toContain("999");
  });

  it("uses local fallback for malformed server output", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ source: "openai" }), { status: 200 }));
    const outcome = await requestScenarioAnalysis(currentScenarioFixture, undefined, { fetcher });
    expect(outcome.analysis.source).toBe("fallback");
  });

  it("uses local fallback when the server sends broken JSON", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("{broken", { status: 200 }));
    const outcome = await requestScenarioAnalysis(currentScenarioFixture, undefined, { fetcher });
    expect(outcome.analysis.source).toBe("fallback");
    expect(outcome.analysis.summary).toContain("56,54");
  });

  it("uses local fallback for a server error response", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 }));
    const outcome = await requestScenarioAnalysis(currentScenarioFixture, undefined, { fetcher });
    expect(outcome.analysis.source).toBe("fallback");
  });

  it("does not show stale fallback after cancellation", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetcher = vi.fn().mockRejectedValue(new DOMException("Aborted", "AbortError"));
    await expect(requestScenarioAnalysis(currentScenarioFixture, undefined, {
      fetcher, signal: controller.signal,
    })).rejects.toThrow();
  });

  it("reports choice errors without sending an AI request", async () => {
    const fetcher = vi.fn();
    const invalid = evaluateScenario([]);
    const outcome = await requestScenarioAnalysis(invalid, undefined, { fetcher });
    expect(outcome.errorKind).toBe("validation");
    expect(outcome.error).toBe(invalid.errors.join(" "));
    expect(outcome.analysis.summary).toContain("нельзя оценить");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("accepts a negative candidate and recalculates untrusted candidate gains", async () => {
    const advisor = findBestReplacement(SECOND_EXAMPLE_DECISIONS);
    if (!advisor.bestByScore) throw new Error("Expected candidate");
    const fetcher = vi.fn().mockRejectedValue(new Error("offline"));
    const outcome = await requestScenarioAnalysis(advisor.current,
      { ...advisor.bestByScore, scoreGain: 999 }, { fetcher });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(outcome.errorKind).toBe("unavailable");
    expect(outcome.analysis.summary).toContain("снижает результат");
    expect(outcome.analysis.recommendations.join(" ")).not.toContain("999");
  });

  it("distinguishes a server validation rejection from provider unavailability", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "План отклонён" }), { status: 400 }));
    const outcome = await requestScenarioAnalysis(currentScenarioFixture, undefined, { fetcher });
    expect(outcome.errorKind).toBe("validation");
    expect(outcome.error).toBe("План отклонён");
  });

  it("discards a late successful response after cancellation", async () => {
    const controller = new AbortController();
    const fetcher = vi.fn().mockImplementation(async () => {
      controller.abort();
      return new Response(JSON.stringify(validAnalysis));
    });
    await expect(requestScenarioAnalysis(currentScenarioFixture, undefined, {
      fetcher, signal: controller.signal,
    })).rejects.toThrow();
  });
});


describe("analysis request deadline", () => {
  it("aborts a stalled network request and returns fallback within its deadline", async () => {
    vi.useFakeTimers();
    try {
      const fetcher = vi.fn((_url: string, options: RequestInit) => new Promise<Response>((_resolve, reject) => {
        options.signal!.addEventListener("abort", () => reject(options.signal!.reason), { once: true });
      }));
      const pending = requestScenarioAnalysis(currentScenarioFixture, undefined, { fetcher: fetcher as typeof fetch });
      await vi.advanceTimersByTimeAsync(ANALYSIS_REQUEST_TIMEOUT_MS);
      const outcome = await pending;
      expect(outcome.analysis.source).toBe("fallback");
      expect(outcome.errorKind).toBe("unavailable");
      expect(fetcher.mock.calls[0][1].signal!.aborted).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not return a stale validation error after cancellation while reading its body", async () => {
    const controller = new AbortController();
    const response = new Response("{}", { status: 400 });
    vi.spyOn(response, "json").mockImplementation(async () => {
      controller.abort();
      return { error: "Old plan" };
    });
    const fetcher = vi.fn().mockResolvedValue(response);
    await expect(requestScenarioAnalysis(currentScenarioFixture, undefined, { fetcher, signal: controller.signal })).rejects.toThrow();
  });
});
