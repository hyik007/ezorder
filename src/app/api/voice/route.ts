import { NextResponse } from "next/server";

interface MenuDishInput {
  id: string;
  number: number;
  nameEn: string;
  nameMs: string;
  nameZh: string;
  price: number;
  inStock: boolean;
  desc?: string;
}

interface IlmuMatchedItem {
  id: string;
  qty: number;
  note?: string;
}

interface IlmuStructuredReply {
  intent: "order" | "sold_out" | "recommend" | "confirm_yes" | "confirm_no" | "clarify";
  orderType: "dine_in" | "takeaway" | null;
  items: IlmuMatchedItem[];
  replyEn: string;
  replyMs: string;
  replyZh: string;
}

export async function POST(req: Request) {
  const apiKey = process.env.ILMU_API_KEY?.trim();
  const baseUrl = (process.env.ILMU_BASE_URL || "https://api.ilmu.ai/v1").replace(/\/+$/, "");
  const asrModel = process.env.ILMU_ASR_MODEL || "ilmu-asr-v4.2";
  const chatModel = process.env.ILMU_CHAT_MODEL || "ilmu-mini-v3.3";

  try {
    const formData = await req.formData();
    const audio = formData.get("audio") as File | null;
    const textInput = (formData.get("text") as string | null)?.trim() || "";
    const lang = ((formData.get("lang") as string | null) || "zh") as "en" | "ms" | "zh";
    const currentOrderType = ((formData.get("orderType") as string | null) || "dine_in") as
      | "dine_in"
      | "takeaway";
    const menuJson = (formData.get("menu") as string | null) || "[]";

    let menu: MenuDishInput[] = [];
    try {
      menu = JSON.parse(menuJson) as MenuDishInput[];
    } catch {
      menu = [];
    }

    let transcript = textInput;

    // 1. Transcribe voice with YTL ILMU ASR if audio was sent and API key is present
    if (!transcript && audio && apiKey) {
      try {
        const asrForm = new FormData();
        asrForm.append("file", audio, audio.name || "order.webm");
        asrForm.append("model", asrModel);

        const asrRes = await fetch(`${baseUrl}/audio/transcriptions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: asrForm,
        });

        if (asrRes.ok) {
          const asrData = (await asrRes.json()) as { text?: string; transcript?: string };
          transcript = (asrData.text || asrData.transcript || "").trim();
        }
      } catch {
        // Continue to chat or client transcript if ASR endpoint is unreachable
      }
    }

    // 2. Ask YTL ILMU Chat Model to reason intelligently (not rigid!)
    if (apiKey && transcript) {
      const systemPrompt = `You are a warm, smart Malaysian Kopitiam waiter helping elderly Aunties & Uncles order food.
Understand English, Bahasa Melayu, Mandarin, Cantonese, Hokkien, and Bahasa Rojak seamlessly.
Here is today's live menu JSON:
${JSON.stringify(menu)}

Rules:
- Match dishes by dish number (#1, #2...), name, dialect slang, or taste description (e.g., "not spicy", "rice", "drink", "noodles").
- Extract quantities (default 1) and any special notes (e.g., "kurang manis", "no peanuts", "extra sambal", "kosong", "peng").
- Detect orderType: "takeaway" if they say tapau/bungkus/打包/takeaway, "dine_in" if they say makan sini/堂食/eat here, or null to keep "${currentOrderType}".
- If a requested dish has inStock=false, set intent="sold_out" and put 1-2 similar inStock=true dishes in "items" as recommendations.
- If the user says yes/confirm/要/好/boleh/ya, set intent="confirm_yes". If no/cancel/不要/tak nak, set intent="confirm_no".
- Keep replyEn, replyMs, and replyZh short, natural, polite, and end with a clear Yes/No question confirming the dish, special note, and dine-in/takeaway status.

Respond ONLY in valid JSON matching this schema:
{
  "intent": "order" | "sold_out" | "recommend" | "confirm_yes" | "confirm_no" | "clarify",
  "orderType": "dine_in" | "takeaway" | null,
  "items": [{"id": "dish_id", "qty": 1, "note": "optional note"}],
  "replyEn": "English readback + Yes/No question",
  "replyMs": "Malay readback + Ya/Tidak question",
  "replyZh": "Chinese readback + 要/不要 question"
}`;

      const chatRes = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: chatModel,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: transcript },
          ],
        }),
      });

      if (chatRes.ok) {
        const chatData = (await chatRes.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const rawContent = chatData.choices?.[0]?.message?.content || "";
        const parsed = JSON.parse(rawContent) as IlmuStructuredReply;

        const localizedReply =
          lang === "zh"
            ? parsed.replyZh
            : lang === "ms"
            ? parsed.replyMs
            : parsed.replyEn;

        return NextResponse.json({
          ok: true,
          transcript,
          ...parsed,
          message: localizedReply,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      transcript,
      items: [],
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Voice processing error",
      },
      { status: 200 }
    );
  }
}