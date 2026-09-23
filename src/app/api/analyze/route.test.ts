import { afterEach, describe, expect, it, vi } from "vitest";

import { currentScenarioFixture, replacementCandidateFixture } from "@/lib/ai/__fixtures__/scenarioFixtures";
import { POST } from "@/app/api/analyze/route";

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
