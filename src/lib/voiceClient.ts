"use client";

import type { NoteKey } from "./types";

/** The phone's side of /api/voice. */

export type VoiceReply = {
  status: "match" | "sold_out" | "suggest";
  heard: string;
  items: { itemId: string; qty: number; notes: NoteKey[] }[];
  /** Dish ids the diner asked for that have run out. */
  soldOut: string[];
  /** Dish ids to offer instead. */
  suggestions: string[];
  /** A short warm line from the AI, in the language the diner spoke. May be empty. */
  message: string;
  engine: string;
};

let engine: Promise<"ilmu" | "browser"> | null = null;

/** Is the ILMU Voice AI switched on for this site? Asked once per page load. */
export function voiceEngine(): Promise<"ilmu" | "browser"> {
  if (!engine) {
    engine = fetch("/api/voice", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { engine: "browser" }))
      .then((d: { engine?: string }) => (d.engine === "ilmu" ? "ilmu" : "browser"))
      .catch(() => "browser" as const);
  }
  return engine;
}

/**
 * Send a clip or typed words for understanding.
 * Returns null when the AI could not be reached, so the screen can fall back.
 */
export async function askVoice(input: { clip: Blob } | { text: string }): Promise<VoiceReply | null> {
  const body = new FormData();
  if ("clip" in input) body.append("audio", input.clip, "order");
  else body.append("text", input.text);
  try {
    const res = await fetch("/api/voice", { method: "POST", body, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return null;
    const d = (await res.json()) as Partial<VoiceReply>;
    return {
      status: d.status === "sold_out" || d.status === "suggest" ? d.status : "match",
      heard: typeof d.heard === "string" ? d.heard : "",
      items: Array.isArray(d.items) ? d.items : [],
      soldOut: Array.isArray(d.soldOut) ? d.soldOut : [],
      suggestions: Array.isArray(d.suggestions) ? d.suggestions : [],
      message: typeof d.message === "string" ? d.message : "",
      engine: typeof d.engine === "string" ? d.engine : "",
    };
  } catch {
    return null;
  }
}
