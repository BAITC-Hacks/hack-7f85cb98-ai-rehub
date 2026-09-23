import { afterEach, describe, expect, it, vi } from "vitest";

import { currentScenarioFixture, replacementCandidateFixture } from "@/lib/ai/__fixtures__/scenarioFixtures";
import { POST } from "@/app/api/analyze/route";
import { EXAMPLE_DECISIONS, simulateScenario } from "../../../../engine/index.mjs";

function request(body: unknown): Request {
  return new Request("http://localhost/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/analyze", () => {
  it("analyzes the official example using the real engine", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const calculated = simulateScenario(EXAMPLE_DECISIONS);
    expect(calculated.valid).toBe(true);
    if (!calculated.valid) return;
    expect(calculated.validation.budget.spent).toBe(95);
    expect(calculated.result.after.score).toBe(56.54307);

    const response = await POST(request({
      decisions: EXAMPLE_DECISIONS,
      scenario: { finalScore: 999 },
    }));
    const analysis = await response.json();
    expect(response.status).toBe(200);
    expect(analysis.source).toBe("fallback");
    expect(analysis.summary).toContain("56,54");
    expect(analysis.summary).not.toContain("999");
    expect(analysis.strengths.join(" ")).toContain("M10 + M12");
  });

  it("analyzes a second valid set of decisions", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const decisions = [
      { measureId: "M9", districtId: "nura" },
      { measureId: "M11", districtId: "nura" },
      { measureId: "M10", districtId: "nura" },
      { measureId: "M12" },
      { measureId: "M4", districtId: "saryarka" },
    ];
    const calculated = simulateScenario(decisions);
    expect(calculated.valid).toBe(true);
    if (!calculated.valid) return;
    expect(calculated.validation.budget.spent).toBe(61);
    expect(calculated.result.after.score).not.toBe(56.54307);

    const response = await POST(request({ decisions }));
    const analysis = await response.json();
    expect(response.status).toBe(200);
    expect(analysis.summary).toContain(calculated.result.after.score.toFixed(2).replace(".", ","));
  });

  it("rejects a real over-budget selection with the engine's reason", async () => {
    const response = await POST(request({ decisions: [
      { measureId: "M3", districtId: "nura" },
      { measureId: "M5", districtId: "saryarka" },
      { measureId: "M7", districtId: "nura" },
      { measureId: "M8", districtId: "nura" },
      { measureId: "M12" },
    ] }));
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.validation.errors.map(({ code }: { code: string }) => code)).toContain("BUDGET_EXCEEDED");
    expect(body.validation.budget.spent).toBe(113);
  });

  it("returns deterministic fallback without an API key", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const response = await POST(request({ scenario: currentScenarioFixture }));
    const analysis = await response.json();

    expect(response.status).toBe(200);
    expect(analysis.source).toBe("fallback");
    expect(analysis.summary).toContain("56,54");
  });

  it("explains the verified replacement", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const response = await POST(request({
      scenario: currentScenarioFixture,
      candidate: replacementCandidateFixture,
    }));
    const analysis = await response.json();

    expect(response.status).toBe(200);
    expect(analysis.recommendations.join(" ")).toContain("M3");
  });

  it("rejects malformed input", async () => {
    const response = await POST(request({ scenario: { valid: true } }));
    expect(response.status).toBe(400);
  });

  it("rejects inconsistent candidate math", async () => {
    const response = await POST(request({
      scenario: currentScenarioFixture,
      candidate: { ...replacementCandidateFixture, scoreGain: 42 },
    }));
    expect(response.status).toBe(400);
  });

  it("rejects invalid JSON", async () => {
    const response = await POST(new Request("http://localhost/api/analyze", {
      method: "POST", body: "{broken",
    }));
    expect(response.status).toBe(400);
  });
});
