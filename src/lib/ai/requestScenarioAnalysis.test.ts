import { describe, expect, it, vi } from "vitest";

import { currentScenarioFixture } from "@/lib/ai/__fixtures__/scenarioFixtures";
import { requestScenarioAnalysis } from "@/lib/ai/requestScenarioAnalysis";

const validAnalysis = {
  source: "openai",
  summary: "Городской результат вырос.",
  strengths: ["Социальные услуги улучшились."],
  risks: ["Один район остаётся слабее."],
  tradeoffs: ["Бюджет почти исчерпан."],
  recommendations: ["Проверить замену меры."],
};

describe("requestScenarioAnalysis", () => {
  it("sends the calculated scenario and accepts a valid answer", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(validAnalysis), { status: 200 }));
    const outcome = await requestScenarioAnalysis(currentScenarioFixture, undefined, { fetcher });

    expect(outcome.analysis.source).toBe("openai");
    expect(outcome.error).toBeNull();
    expect(fetcher).toHaveBeenCalledWith("/api/analyze", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(fetcher.mock.calls[0][1].body).scenario.finalScore).toBe(56.54307);
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

  it("uses local fallback for malformed server output", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ source: "openai" }), { status: 200 }));
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
});
