import { parseOrder, replacementsFor, suggestDishes } from "@/lib/match";
import { IlmuError, ilmuConfigured, ilmuModels, transcribe, understand, type Understood } from "@/lib/server/ilmu";
import { serverMenu } from "@/lib/server/menu";

/*
  POST /api/voice   multipart: "audio" (a short recording) or "text" (typed words)
  -> { status, heard, items, soldOut, suggestions, message, engine }

      status "match"     everything asked for is available -> items
             "sold_out"  something has run out -> soldOut names it, suggestions replace it
             "suggest"   nothing certain -> suggestions to tap instead

  GET  /api/voice   -> { engine: "ilmu" | "browser" }   so the phone knows whether to record.

  Fallback ladder, so a diner is never left with nothing:
    ILMU speech + ILMU understanding
    -> ILMU speech + the built-in word matcher       (if the understanding step fails)
    -> 503 "use the phone"                           (if speech fails; the phone then listens itself)
  Sold-out dishes are filtered out here, so one can never slip into a cart.
*/

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_AUDIO_BYTES = 2_000_000; // an 8-second phone clip is ~40 kB
const MAX_TEXT = 300;

// Best-effort limit per address, to stop one visitor burning the ILMU balance.
// Resets when the server restarts; put a real limiter in front for production traffic.
const hits = new Map<string, { n: number; since: number }>();
const LIMIT = 20;
const WINDOW_MS = 60_000;

function tooMany(req: Request): boolean {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.since > WINDOW_MS) {
    hits.set(ip, { n: 1, since: now });
    if (hits.size > 5000) hits.clear();
    return false;
  }
  h.n++;
  return h.n > LIMIT;
}

/** Only our own pages may call this. Browsers always send Origin on a cross-site POST. */
function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === (req.headers.get("x-forwarded-host") ?? req.headers.get("host"));
  } catch {
    return false;
  }
}

export async function GET() {
  return Response.json({ engine: ilmuConfigured() ? "ilmu" : "browser" });
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: "forbidden" }, { status: 403 });
  if (tooMany(req)) return Response.json({ error: "rate_limited" }, { status: 429 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Send multipart form data" }, { status: 400 });
  }
  const audio = form.get("audio");
  const typed = form.get("text");
  const clip = audio instanceof Blob && audio.size > 0 ? audio : null;
  const text = typeof typed === "string" ? typed.trim().slice(0, MAX_TEXT) : "";
  if (!clip && !text) return Response.json({ error: "Send audio or text" }, { status: 400 });
  if (clip && clip.size > MAX_AUDIO_BYTES) return Response.json({ error: "Recording is too long" }, { status: 413 });

  const menu = await serverMenu();
  const useIlmu = ilmuConfigured();

  // 1. Hear.
  let heard = text;
  if (clip) {
    if (!useIlmu) return Response.json({ error: "voice_ai_off" }, { status: 503 });
    try {
      heard = await transcribe(clip, menu);
    } catch (e) {
      logFailure(e);
      return Response.json({ error: "asr_failed" }, { status: 503 });
    }
    if (!heard) {
      return Response.json({
        status: "suggest",
        heard: "",
        items: [],
        soldOut: [],
        suggestions: [],
        message: "",
        engine: ilmuModels.asr,
      });
    }
  }

  // 2. Understand.
  let result: Understood | null = null;
  let engine = clip ? ilmuModels.asr : "typed";
  if (useIlmu) {
    try {
      result = await understand(heard, menu);
      engine += `+${ilmuModels.chat}`;
    } catch (e) {
      logFailure(e);
    }
  }
  // The built-in matcher steps in when ILMU is unavailable, or found nothing and did not say why.
  if (!result || (result.items.length === 0 && result.status === "match")) {
    const local = parseOrder(heard, menu);
    if (local.length > 0) {
      result = { status: "match", items: local, soldOut: [], suggestions: [], message: result?.message ?? "" };
      engine += "+matcher";
    }
  }

  // 3. A sold-out dish never reaches the cart, whichever engine matched it.
  //    Three ways one can show up: the AI names it, the AI left it in items, or only the
  //    word matcher heard it. The diner must be told in every case.
  const stock = new Map(menu.map((m) => [m.id, m.inStock]));
  const asked = result?.items ?? [];
  const items = asked.filter((i) => stock.get(i.itemId));
  const soldOut = [
    ...new Set([
      ...(result?.soldOut ?? []),
      ...asked.filter((i) => !stock.get(i.itemId)).map((i) => i.itemId),
      ...parseOrder(heard, menu)
        .map((i) => i.itemId)
        .filter((id) => stock.get(id) === false),
    ]),
  ];

  // 4. What to offer instead: replacements for what ran out, or the closest guesses.
  const suggestions = [
    ...new Set([
      ...(result?.suggestions ?? []),
      ...replacementsFor(soldOut, menu),
      ...(items.length === 0 && soldOut.length === 0 ? suggestDishes(heard, menu) : []),
    ]),
  ]
    .filter((id) => !items.some((i) => i.itemId === id) && !soldOut.includes(id))
    .slice(0, 4);

  const status: Understood["status"] = soldOut.length > 0 ? "sold_out" : items.length > 0 ? "match" : "suggest";

  return Response.json({ status, heard, items, soldOut, suggestions, message: result?.message ?? "", engine });
}

function logFailure(e: unknown) {
  if (e instanceof IlmuError) console.error(`ILMU ${e.stage} failed: ${e.message}`);
  else console.error("Voice order failed:", e instanceof Error ? e.message : e);
}
