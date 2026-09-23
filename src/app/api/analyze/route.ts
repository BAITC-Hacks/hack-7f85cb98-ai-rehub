import { evaluateScenario } from "@/domain";
import { analyzeScenario } from "@/lib/ai/analyze";
import { toReplacementCandidate } from "@/lib/ai/engineScenario";
import { analyzeRequestSchema } from "@/lib/ai/schemas";

const MAX_REQUEST_BYTES = 16 * 1024;
class RequestTooLarge extends Error {}

async function readBoundedJson(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (declaredLength > MAX_REQUEST_BYTES) throw new RequestTooLarge();
  if (!request.body) throw new SyntaxError("Missing body");
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_REQUEST_BYTES) {
        await reader.cancel();
        throw new RequestTooLarge();
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await readBoundedJson(request);
  } catch (error) {
    if (error instanceof RequestTooLarge) {
      return Response.json({ error: "Слишком большой запрос. Передайте только выбранные решения." }, { status: 413 });
    }
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
