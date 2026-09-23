import { expect, it } from "vitest";

import { changedDistrictScenario } from "@/lib/ai/__fixtures__/changedDistrictScenario";
import { analyzeScenario } from "@/lib/ai/analyze";

// Opt-in: RUN_LIVE_AI=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run src/lib/ai/liveEvaluation.test.ts
it.skipIf(process.env.RUN_LIVE_AI !== "1")("explains a recalculated scenario on changed district data", async () => {
  const scenario = changedDistrictScenario();
  expect(scenario.baselineScore).toBeCloseTo(48.91492, 5);
  expect(scenario.finalScore).toBeCloseTo(50.90031, 5);
  expect(scenario.criticalBefore).toBe(4);
  expect(scenario.criticalAfter).toBe(4);

  const analysis = await analyzeScenario(scenario);
  console.log(JSON.stringify({
    calculated: {
      baselineScore: scenario.baselineScore,
      finalScore: scenario.finalScore,
      criticalBefore: scenario.criticalBefore,
      criticalAfter: scenario.criticalAfter,
    },
    analysis,
  }, null, 2));
  expect(analysis.source).toBe("openai");
  expect(analysis.risks.join(" ")).toContain("Нура");
  expect(analysis.risks.join(" ")).toContain("критические показатели");
}, 35_000);
