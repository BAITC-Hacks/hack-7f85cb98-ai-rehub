import { afterEach, describe, expect, it, vi } from "vitest";

import { currentScenarioFixture, replacementCandidateFixture } from "@/lib/ai/__fixtures__/scenarioFixtures";
import { createFallbackAnalysis } from "@/lib/ai/fallbackAnalysis";

const parse = vi.hoisted(() => vi.fn());
vi.mock("openai", () => ({
  default: class {
    responses = { parse };
  },
}));

import { analyzeScenario } from "@/lib/ai/analyze";

afterEach(() => {
  parse.mockReset();
  vi.unstubAllEnvs();
});

describe("analyzeScenario", () => {
  it("uses model priorities without changing or omitting verified facts", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    parse.mockResolvedValue({ status: "completed", output_parsed: {
      priorityIds: ["risks:0", "strengths:2", "strengths:0"],
    } });

    const verified = createFallbackAnalysis(currentScenarioFixture);
    const result = await analyzeScenario(currentScenarioFixture);
    expect(result.source).toBe("openai");
    expect(result.summary).toBe(verified.summary);
    expect(result.strengths).toEqual([
      verified.strengths[2], verified.strengths[0], ...verified.strengths.slice(1, 2),
      ...verified.strengths.slice(3),
    ]);
    expect(result.risks).toEqual(verified.risks);
    expect(result.recommendations).toEqual(verified.recommendations);
    expect(parse).toHaveBeenCalledOnce();
    const request = parse.mock.calls[0][0];
    const cards = JSON.parse(request.input[1].content).cards;
    expect(cards.find((card: { id: string }) => card.id === "risks:0").text).toBe(verified.risks[0]);
  });

  it("keeps the verified replacement recommendation", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    parse.mockResolvedValue({ status: "completed", output_parsed: { priorityIds: ["recommendations:0"] } });
    const result = await analyzeScenario(currentScenarioFixture, replacementCandidateFixture);
    expect(result.source).toBe("openai");
    expect(result.recommendations.join(" ")).toContain("M3");
    expect(result.recommendations.join(" ")).toContain("0,66");
  });

  it.each([
    { priorityIds: ["risks:999"] },
    { priorityIds: ["risks:0", "risks:0"] },
    { priorityIds: [] },
    { priorityIds: ["риски из головы"] },
    { summary: "Результат вырос на 99 пунктов.", priorityIds: ["risks:0"] },
  ])("falls back on invalid model output: %j", async (output) => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    parse.mockResolvedValue({ status: "completed", output_parsed: output });
    expect(await analyzeScenario(currentScenarioFixture)).toEqual(createFallbackAnalysis(currentScenarioFixture));
  });

  it("falls back on API failure", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    parse.mockRejectedValue(new Error("network unavailable"));
    expect(await analyzeScenario(currentScenarioFixture)).toEqual(createFallbackAnalysis(currentScenarioFixture));
  });

  it.each([
    { status: "completed", output_parsed: "{broken" },
    { status: "completed", output_parsed: null },
    { status: "incomplete", output_parsed: { priorityIds: ["risks:0"] } },
  ])("falls back when the model response is not valid JSON data: %j", async (response) => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    parse.mockResolvedValue(response);
    expect(await analyzeScenario(currentScenarioFixture)).toEqual(createFallbackAnalysis(currentScenarioFixture));
  });

  it("falls back when the SDK cannot parse model JSON", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    parse.mockRejectedValue(new SyntaxError("Unexpected end of JSON input"));
    expect(await analyzeScenario(currentScenarioFixture)).toEqual(createFallbackAnalysis(currentScenarioFixture));
  });
});


describe("verified calculation context", () => {
  it("supplies actual measure costs, lag-adjusted effects, district deltas and replacement facts", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    parse.mockResolvedValue({ status: "completed", output_parsed: { priorityIds: ["risks:0"] } });
    await analyzeScenario(currentScenarioFixture, replacementCandidateFixture);
    const payload = JSON.parse(parse.mock.calls[0][0].input[1].content);
    expect(payload.calculation.decisions).toEqual(currentScenarioFixture.decisions);
    expect(payload.calculation.totalCost).toBe(95);
    expect(payload.calculation.finalScore).toBe(currentScenarioFixture.finalScore);
    expect(payload.calculation.measures).toHaveLength(5);
    expect(payload.calculation.measures.find((measure: { measureId: string }) => measure.measureId === "M5"))
      .toMatchObject({ cost: 25, lagQuarters: 3, realizedFraction: 0.625, realizedEffects: { E2: 8.75, C1: 2.5 } });
    expect(payload.calculation.districts[0].indicatorDeltas).toEqual(currentScenarioFixture.districts[0].indicatorDeltas);
    expect(payload.calculation.synergies).toEqual(currentScenarioFixture.synergies);
    expect(payload.replacement.calculation.finalScore).toBe(replacementCandidateFixture.result.finalScore);
    expect(payload.replacement.scoreGain).toBe(replacementCandidateFixture.scoreGain);
    expect(payload).not.toHaveProperty("prompt");
  });

  it("does not call the provider without an API key", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    expect((await analyzeScenario(currentScenarioFixture)).source).toBe("fallback");
    expect(parse).not.toHaveBeenCalled();
  });
});
