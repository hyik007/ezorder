// npm run ilmu:check
// Checks your ILMU key before you rely on voice ordering. Reads ILMU_API_KEY from .env.local.
// 1. Lists the models your key can use.  2. Asks the chat model to match a rojak sentence.
// 3. Optional: node scripts/check-ilmu.mjs path/to/recording.webm  transcribes a real clip.
import { readFileSync, existsSync } from "node:fs";
import { basename } from "node:path";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const key = process.env.ILMU_API_KEY;
const base = (process.env.ILMU_BASE_URL || "https://api.ilmu.ai/v1").replace(/\/$/, "");
const asr = process.env.ILMU_ASR_MODEL || "ilmu-asr-v4.2";
const chat = process.env.ILMU_CHAT_MODEL || "ilmu-mini-v3.3";
if (!key) {
  console.error("ILMU_API_KEY is not set. Add it to .env.local (get one at https://console.ilmu.ai).");
  process.exit(1);
}
const auth = { Authorization: `Bearer ${key}` };
let failed = false;
const step = async (name, fn) => {
  try {
    console.log(`✓ ${name}: ${await fn()}`);
  } catch (e) {
    failed = true;
    console.error(`✗ ${name}: ${e.message}`);
  }
};

await step("models", async () => {
  const r = await fetch(`${base}/models`, { headers: auth });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  const ids = (await r.json()).data.map((m) => m.id);
  for (const want of [asr, chat]) if (!ids.includes(want)) throw new Error(`${want} is not available to this key. You have: ${ids.join(", ")}`);
  return `${asr} and ${chat} available`;
});

await step("understanding", async () => {
  const r = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: chat,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: 'Menu ids: teh-tarik, laksa. Reply only JSON {"items":[{"itemId":"...","qty":1}]}.' },
        { role: "user", content: "uncle, teh tarik siew dai dua, laksa satu ah" },
      ],
    }),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return (await r.json()).choices[0].message.content;
});

const clip = process.argv[2];
if (clip) {
  await step("transcription", async () => {
    const form = new FormData();
    form.append("file", new Blob([readFileSync(clip)]), basename(clip));
    form.append("model", asr);
    const r = await fetch(`${base}/audio/transcriptions`, { method: "POST", headers: auth, body: form });
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
    return JSON.stringify((await r.json()).text);
  });
}
process.exit(failed ? 1 : 0);
