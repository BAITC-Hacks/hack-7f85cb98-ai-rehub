import { afterEach, describe, expect, it, vi } from "vitest";

import { currentScenarioFixture } from "@/lib/ai/__fixtures__/scenarioFixtures";

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
  it("accepts a structured model response", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    parse.mockResolvedValue({ status: "completed", output_parsed: {
      summary: "Городской результат вырос.",
      strengths: ["Улучшились социальные услуги."],
      risks: ["Один район остаётся слабее остальных."],
      tradeoffs: ["План расходует большую часть бюджета."],
      recommendations: ["Проверить замену одной меры."],
    } });

    const result = await analyzeScenario(currentScenarioFixture);
    expect(result.source).toBe("openai");
    expect(parse).toHaveBeenCalledOnce();
  });

  it("falls back on API failure", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    parse.mockRejectedValue(new Error("network unavailable"));
    expect((await analyzeScenario(currentScenarioFixture)).source).toBe("fallback");
  });

  it("falls back when the model adds unsupported figures", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    parse.mockResolvedValue({ status: "completed", output_parsed: {
      summary: "Результат вырос на 99 пунктов.",
      strengths: [], risks: [], tradeoffs: [], recommendations: ["Продолжить."],
    } });
    expect((await analyzeScenario(currentScenarioFixture)).source).toBe("fallback");
  });
});
