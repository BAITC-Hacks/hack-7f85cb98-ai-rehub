import { describe, expect, it, vi } from "vitest";

import { currentScenarioFixture, replacementCandidateFixture } from "@/lib/ai/__fixtures__/scenarioFixtures";
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
});
