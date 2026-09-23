import { evaluateScenario } from "@/domain";
import { analyzeScenario } from "@/lib/ai/analyze";
import { toReplacementCandidate } from "@/lib/ai/engineScenario";
import { analyzeRequestSchema } from "@/lib/ai/schemas";

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
  const scenario = evaluateScenario(decisions);
  if (!scenario.valid) {
    return Response.json({
      error: "Некорректный набор решений",
      validation: scenario,
    }, { status: 400 });
  }

  let candidate;
  if (replacementDecisions !== undefined) {
    const replacement = evaluateScenario(replacementDecisions);
    if (!replacement.valid) {
      return Response.json({
        error: "Некорректная контрфактическая замена",
        validation: replacement,
      }, { status: 400 });
    }
    candidate = toReplacementCandidate(
      scenario.decisions, scenario, replacement.decisions, replacement,
    );
    if (!candidate) {
      return Response.json({
        error: "Замена должна менять ровно одну меру на новую, отсутствующую в исходном плане",
      }, { status: 400 });
    }
  }

  return Response.json(await analyzeScenario(scenario, candidate));
}
