import { analyzeScenario } from "@/lib/ai/analyze";
import { toAnalysisScenario } from "@/lib/ai/engineScenario";
import { analyzeRequestSchema } from "@/lib/ai/schemas";
import { simulateScenario } from "../../../../engine/index.mjs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  if (body !== null && typeof body === "object" && "decisions" in body) {
    const simulation = simulateScenario((body as { decisions: unknown }).decisions);
    if (!simulation.valid) {
      return Response.json({
        error: "Некорректный набор решений",
        validation: simulation.validation,
      }, { status: 400 });
    }
    return Response.json(await analyzeScenario(toAnalysisScenario(simulation)));
  }

  const parsed = analyzeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Некорректный результат сценария" }, { status: 400 });
  }

  const { scenario, candidate } = parsed.data;
  if (candidate && (!candidate.result.valid || candidate.scoreGain <= 0 ||
    Math.abs(candidate.result.finalScore - scenario.finalScore - candidate.scoreGain) > 0.02)) {
    return Response.json({ error: "Некорректная контрфактическая замена" }, { status: 400 });
  }

  return Response.json(await analyzeScenario(scenario, candidate));
}
