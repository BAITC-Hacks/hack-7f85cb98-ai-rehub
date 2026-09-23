import { analyzeScenario } from "@/lib/ai/analyze";
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
    return Response.json({ error: "Некорректный результат сценария" }, { status: 400 });
  }

  const { scenario, candidate } = parsed.data;
  if (candidate && (!candidate.result.valid || candidate.scoreGain <= 0 ||
    Math.abs(candidate.result.finalScore - scenario.finalScore - candidate.scoreGain) > 0.02)) {
    return Response.json({ error: "Некорректная контрфактическая замена" }, { status: 400 });
  }

  return Response.json(await analyzeScenario(scenario, candidate));
}
