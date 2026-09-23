import { analyzeScenario } from "@/lib/ai/analyze";
import { toAnalysisScenario, toReplacementCandidate } from "@/lib/ai/engineScenario";
import { analyzeRequestSchema } from "@/lib/ai/schemas";
import { simulateScenario } from "../../../../engine/index.mjs";
import type { Decision } from "../../../../engine/index.mjs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = analyzeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Ожидается набор решений" }, { status: 400 });
  }

  const { decisions, replacementDecisions } = parsed.data;
  const simulation = simulateScenario(decisions);
  if (!simulation.valid) {
    return Response.json({
      error: "Некорректный набор решений",
      validation: simulation.validation,
    }, { status: 400 });
  }

  let candidate;
  if (replacementDecisions !== undefined) {
    const replacement = simulateScenario(replacementDecisions);
    if (!replacement.valid) {
      return Response.json({
        error: "Некорректная контрфактическая замена",
        validation: replacement.validation,
      }, { status: 400 });
    }
    // A successful simulation has validated both decision arrays.
    candidate = toReplacementCandidate(
      decisions as Decision[], simulation,
      replacementDecisions as Decision[], replacement,
    );
    if (!candidate) {
      return Response.json({ error: "Замена должна менять одно решение и улучшать Score" }, { status: 400 });
    }
  }

  return Response.json(await analyzeScenario(toAnalysisScenario(simulation), candidate));
}
