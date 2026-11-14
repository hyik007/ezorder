import type { MenuItem, NoteKey } from "../types";

/*
  ILMU API by YTL AI Labs: Malaysian models hosted on Malaysian infrastructure.
  Docs: https://docs.ilmu.ai  ·  Keys: https://console.ilmu.ai

  Two calls per spoken order:
    1. ilmu-asr-v4.2   speech -> text. Built for Malaysian speech, including English /
                       Bahasa Malaysia / Mandarin code-switching and background noise.
    2. ilmu-mini-v3.3  text + this restaurant's menu (with stock) -> dishes, as JSON.

  Server only. The key must never reach the browser.
*/

const BASE = (process.env.ILMU_BASE_URL ?? "https://api.ilmu.ai/v1").replace(/\/$/, "");
const ASR_MODEL = process.env.ILMU_ASR_MODEL ?? "ilmu-asr-v4.2";
const CHAT_MODEL = process.env.ILMU_CHAT_MODEL ?? "ilmu-mini-v3.3";
const NOTE_KEYS: NoteKey[] = ["less-sweet", "no-sugar", "not-spicy", "iced", "hot", "takeaway"];

export const ilmuModels = { asr: ASR_MODEL, chat: CHAT_MODEL };

export function ilmuConfigured(): boolean {
  return Boolean(process.env.ILMU_API_KEY);
}

export class IlmuError extends Error {
  constructor(
    readonly stage: "asr" | "chat",
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function headers(): Record<string, string> {
  return { Authorization: `Bearer ${process.env.ILMU_API_KEY}` };
}

/** ILMU identifies the audio format from the file name, so the extension must match the bytes. */
function fileNameFor(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes("mp4") || m.includes("aac")) return "order.mp4";
  if (m.includes("m4a")) return "order.m4a";
  if (m.includes("ogg")) return "order.ogg";
  if (m.includes("wav")) return "order.wav";
  if (m.includes("mpeg") || m.includes("mp3")) return "order.mp3";
  return "order.webm";
}

/**
 * Words that bias the recogniser towards this menu and towards kopitiam speech.
 * ILMU takes a free-text `prompt` hint. Kept short: a hint, not a script.
 */
function vocabulary(menu: MenuItem[]): string {
  const words = new Set<string>();
  for (const m of menu) {
    words.add(m.name.en);
    words.add(m.name.ms);
    words.add(m.name.zh);
    for (const a of m.aliases) words.add(a);
  }
  for (const slang of [
    "kurang manis",
    "siew dai",
    "kosong",
    "peng",
    "ais",
    "tapau",
    "bungkus",
    "打包",
    "少甜",
    "走糖",
  ]) {
    words.add(slang);
  }
  return `Order at a Malaysian kopitiam, spoken in mixed Malay, English, Mandarin, Cantonese or Hokkien. ${[
    ...words,
  ].join(", ")}`.slice(0, 900);
}

/** Step 1: speech to text. No language hint, because one sentence can mix several. */
export async function transcribe(audio: Blob, menu: MenuItem[]): Promise<string> {
  const form = new FormData();
  form.append("file", audio, fileNameFor(audio.type));
  form.append("model", ASR_MODEL);
  form.append("prompt", vocabulary(menu));
  form.append("response_format", "json");
  form.append("temperature", "0");
  const res = await fetch(`${BASE}/audio/transcriptions`, {
    method: "POST",
    headers: headers(),
    body: form,
    // Short clips come back in a second or two; ILMU allows up to 120 s for long files.
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new IlmuError("asr", res.status, await errorText(res));
  const data = (await res.json()) as { text?: unknown };
  return typeof data.text === "string" ? data.text.trim() : "";
}

export type Understood = {
  /** match: everything is available. sold_out: something has run out. suggest: nothing certain. */
  status: "match" | "sold_out" | "suggest";
  items: { itemId: string; qty: number; notes: NoteKey[] }[];
  /** Dishes the diner asked for that have run out, so the screen can name them. */
  soldOut: string[];
  /** Dishes to offer instead: replacements for a sold-out dish, or the closest guesses. */
  suggestions: string[];
  /** One short, warm line for the diner, in the language they spoke. */
  message: string;
};

function systemPrompt(menu: MenuItem[]): string {
  const compact = menu.map((m) => ({
    id: m.id,
    kind: m.kind,
    category: m.category,
    in_stock: m.inStock,
    names: [...new Set([m.name.en, m.name.ms, m.name.zh, ...m.aliases])],
  }));
  return `You take food orders at a Malaysian kopitiam. The diner is usually elderly and speaks
Bahasa Rojak: Malay, English, Mandarin, Cantonese, Hokkien and Tamil mixed in one sentence.
The text you receive came from speech recognition, so the spelling is often wrong.

MENU (JSON): ${JSON.stringify(compact)}

Match by SOUND and MEANING, not spelling:
- Cantonese and Hokkien as people say them: "kopi peng" and "teh ping" (iced), "ji png" and "kai pui"
  (chicken rice), "shui gao" (dumpling), "tapau" or "da bao" (takeaway), "siew dai" (less sweet),
  "kosong" (no sugar).
- Heavy recognition errors: "nasi lemk", "teh tarek", "chiken rais", "laksar" all mean the obvious dish.
- Quantities in any language: satu, dua, nng, loeng, 两, rendu.

Reply with ONLY this JSON object:
{"status": "match" | "sold_out" | "suggest",
 "items": [{"itemId": "<id from MENU>", "qty": <1-10>, "notes": [<any of ${JSON.stringify(NOTE_KEYS)}>]}],
 "sold_out": ["<id from MENU that the diner asked for but is out of stock>", ...],
 "suggestions": ["<id from MENU>", ...],
 "message": "<one short warm line>"}

Rules:
1. "match": every dish you matched has in_stock true. Put them in "items" and leave "suggestions" empty.
2. "sold_out": the diner asked for a dish with in_stock false. Leave that dish OUT of "items", name it in
   "sold_out", keep any other dish they asked for in "items", and put 1 or 2 similar IN-STOCK dishes
   (same category where you can) in "suggestions".
3. "suggest": you are unsure, or nothing on the menu fits. Leave "items" empty and put 1 to 3 closest
   in-stock dishes in "suggestions".
4. Never invent a dish, and never return an id that is not in MENU.
5. "message": one short, warm, elderly-friendly sentence in the language the diner used. Address them as
   Uncle or Auntie where it fits, for example "Aiya, laksa habis already Uncle. Try this one?" or
   "Baik Auntie, saya sudah catat." No emoji.`;
}

/** Step 2: text plus this restaurant's menu and stock, turned into an order. */
export async function understand(text: string, menu: MenuItem[]): Promise<Understood> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: systemPrompt(menu) },
        { role: "user", content: text.slice(0, 500) },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 400,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new IlmuError("chat", res.status, await errorText(res));
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content.replace(/```json|```/g, "").trim()) as {
    status?: unknown;
    items?: unknown;
    sold_out?: unknown;
    suggestions?: unknown;
    message?: unknown;
  };
  return {
    status: parsed.status === "sold_out" || parsed.status === "suggest" ? parsed.status : "match",
    items: cleanItems(parsed.items, menu),
    soldOut: cleanIds(parsed.sold_out, menu, { inStockOnly: false }),
    suggestions: cleanIds(parsed.suggestions, menu),
    message: typeof parsed.message === "string" ? parsed.message.trim().slice(0, 160) : "",
  };
}

/** Never trust model output: real menu ids only, quantity 1-10, known requests, one row per dish. */
export function cleanItems(raw: unknown, menu: MenuItem[]): Understood["items"] {
  const ids = new Set(menu.map((m) => m.id));
  const merged = new Map<string, Understood["items"][number]>();
  for (const r of Array.isArray(raw) ? raw : []) {
    if (!r || typeof r !== "object") continue;
    const row = r as { itemId?: unknown; qty?: unknown; notes?: unknown };
    if (typeof row.itemId !== "string" || !ids.has(row.itemId)) continue;
    const qty = Math.max(1, Math.min(10, Math.round(Number(row.qty)) || 1));
    const notes = (Array.isArray(row.notes) ? row.notes : []).filter((n): n is NoteKey =>
      NOTE_KEYS.includes(n as NoteKey),
    );
    const seen = merged.get(row.itemId);
    if (seen) seen.qty = Math.min(10, seen.qty + qty);
    else merged.set(row.itemId, { itemId: row.itemId, qty, notes });
  }
  return [...merged.values()];
}

/** Real menu ids only. Suggestions must also be things the diner can order right now. */
function cleanIds(raw: unknown, menu: MenuItem[], opts: { inStockOnly?: boolean } = {}): string[] {
  const { inStockOnly = true } = opts;
  const ids = new Set(menu.filter((m) => !inStockOnly || m.inStock).map((m) => m.id));
  return [
    ...new Set((Array.isArray(raw) ? raw : []).filter((x): x is string => typeof x === "string" && ids.has(x))),
  ].slice(0, 4);
}

async function errorText(res: Response): Promise<string> {
  try {
    const body = await res.text();
    return `${res.status} ${body.slice(0, 200)}`;
  } catch {
    return String(res.status);
  }
}
