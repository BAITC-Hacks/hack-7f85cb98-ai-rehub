import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/analyze/route";
import { EXAMPLE_DECISIONS, SECOND_EXAMPLE_DECISIONS, evaluateScenario, findBestReplacement } from "@/domain";

const parse = vi.hoisted(() => vi.fn());
vi.mock("openai", () => ({ default: class { responses = { parse }; } }));

function request(body: unknown): Request {
  return new Request("http://localhost/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  parse.mockReset();
  vi.unstubAllEnvs();
});

describe("POST /api/analyze", () => {
  it("analyzes the official example using the real engine", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const calculated = evaluateScenario(EXAMPLE_DECISIONS);
    expect(calculated.valid).toBe(true);
    if (!calculated.valid) return;
    expect(calculated.totalCost).toBe(95);
    expect(calculated.finalScore).toBeCloseTo(56.54307, 8);

    const response = await POST(request({ decisions: EXAMPLE_DECISIONS }));
    const analysis = await response.json();
    expect(response.status).toBe(200);
    expect(analysis.source).toBe("fallback");
    expect(analysis.summary).toContain("56,54");
    expect(analysis.strengths.join(" ")).toContain("M10+M12");
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
    const calculated = evaluateScenario(decisions);
    expect(calculated.valid).toBe(true);
    if (!calculated.valid) return;
    expect(calculated.totalCost).toBe(61);
    expect(calculated.finalScore).not.toBeCloseTo(56.54307, 8);

    const response = await POST(request({ decisions }));
    const analysis = await response.json();
    expect(response.status).toBe(200);
    expect(analysis.summary).toContain(calculated.finalScore.toFixed(2).replace(".", ","));
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
    expect(body.validation.errorDetails.map(({ code }: { code: string }) => code)).toContain("BUDGET_EXCEEDED");
    expect(body.validation.totalCost).toBe(113);
  });

  it("recalculates and explains a one-decision replacement", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const response = await POST(request({
      decisions: EXAMPLE_DECISIONS,
      replacementDecisions: [
        ...EXAMPLE_DECISIONS.filter(({ measureId }) => measureId !== "M5"),
        { measureId: "M3", districtId: "nura" },
      ],
    }));
    const analysis = await response.json();

    expect(response.status).toBe(200);
    expect(analysis.recommendations.join(" ")).toContain("M3");
    expect(analysis.summary).toContain("57,21");
  });

  it("rejects client-supplied results and costs", async () => {
    const response = await POST(request({ decisions: EXAMPLE_DECISIONS, scenario: { finalScore: 999 } }));
    expect(response.status).toBe(400);
  });

  it("rejects a replacement that changes two decisions", async () => {
    const response = await POST(request({
      decisions: EXAMPLE_DECISIONS,
      replacementDecisions: [
        ...EXAMPLE_DECISIONS.filter(({ measureId }) => !["M5", "M10"].includes(measureId)),
        { measureId: "M3", districtId: "nura" },
        { measureId: "M11", districtId: "nura" },
      ],
    }));
    expect(response.status).toBe(400);
  });

  it("rejects a globally incompatible M1 and M3 pair", async () => {
    const response = await POST(request({ decisions: [
      { measureId: "M1", districtId: "nura" },
      { measureId: "M3", districtId: "yesil" },
      { measureId: "M4", districtId: "saryarka" },
      { measureId: "M9", districtId: "almaty" },
      { measureId: "M10", districtId: "baikonur" },
    ] }));
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.validation.errorDetails.map(({ code }: { code: string }) => code)).toContain("INCOMPATIBLE_MEASURES");
  });

  it("rejects invalid JSON", async () => {
    const response = await POST(new Request("http://localhost/api/analyze", {
      method: "POST", body: "{broken",
    }));
    expect(response.status).toBe(400);
  });

  it("accepts a valid negative one-measure replacement", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const advisor = findBestReplacement(SECOND_EXAMPLE_DECISIONS);
    if (!advisor.bestByScore) throw new Error("Expected candidate");
    const response = await POST(request({
      decisions: SECOND_EXAMPLE_DECISIONS,
      replacementDecisions: advisor.bestByScore.decisions,
    }));
    const analysis = await response.json();
    expect(response.status).toBe(200);
    expect(analysis.summary).toContain("снижает результат");
    expect(analysis.recommendations.join(" ")).toContain("Улучшение одной заменой не найдено");
  });

  it("rejects moving the same measure to another district", async () => {
    const response = await POST(request({
      decisions: EXAMPLE_DECISIONS,
      replacementDecisions: EXAMPLE_DECISIONS.map((decision) => decision.measureId === "M5"
        ? { ...decision, districtId: "yesil" } : decision),
    }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("на новую");
  });

  it.each([
    EXAMPLE_DECISIONS.slice(0, 4),
    [...EXAMPLE_DECISIONS.slice(0, 4), EXAMPLE_DECISIONS[0]],
    EXAMPLE_DECISIONS.map((decision) => decision.measureId === "M5"
      ? { ...decision, districtId: "esil" } : decision),
    EXAMPLE_DECISIONS.map((decision) => decision.measureId === "M12"
      ? { ...decision, districtId: "nura" } : decision),
  ].map((decisions) => ({ decisions })))("does not call the paid provider for invalid decisions: %j", async ({ decisions }) => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const response = await POST(request({ decisions }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.validation.valid).toBe(false);
    expect(body.validation.finalScore).toBeNull();
    expect(body.validation.errorDetails.length).toBeGreaterThan(0);
    expect(parse).not.toHaveBeenCalled();
  });

  it("returns the deterministic explanation when the provider fails", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    parse.mockRejectedValue(new Error("provider timeout"));
    const response = await POST(request({ decisions: EXAMPLE_DECISIONS }));
    const analysis = await response.json();
    expect(response.status).toBe(200);
    expect(analysis.source).toBe("fallback");
    expect(analysis.summary).toContain("56,54");
  });
});
