import type { Lang } from "./types";

// The word matcher lives in match.ts so the server can use it too.
export { parseOrder, replacementsFor, suggestDishes, type ParsedItem } from "./match";

/* ---------- Browser speech: listening and speaking ---------- */

export type SpeechLang = { code: string; label: string };

/** Languages the browser can listen in. Hokkien and Teochew are not offered by any browser today. */
export const SPEECH_LANGS: Record<Lang, SpeechLang[]> = {
  en: [{ code: "en-US", label: "English" }],
  ms: [{ code: "ms-MY", label: "Bahasa Melayu" }],
  zh: [
    { code: "zh-CN", label: "华语 Mandarin" },
    { code: "yue-Hant-HK", label: "广东话 Cantonese" },
  ],
};

type RecognitionResultEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
};

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function canListen(): boolean {
  return recognitionCtor() !== null;
}

/**
 * Start listening. Calls onText with what has been heard so far, and onDone with the final words
 * (empty string when nothing was heard or the microphone was blocked).
 */
export function listen(
  langCode: string,
  onText: (text: string) => void,
  onDone: (finalText: string) => void,
): { stop: () => void; cancel: () => void } {
  const Ctor = recognitionCtor();
  if (!Ctor) {
    onDone("");
    return { stop: () => {}, cancel: () => {} };
  }
  const rec = new Ctor();
  rec.lang = langCode;
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;
  let latest = "";
  let cancelled = false;
  let finished = false;
  rec.onresult = (e) => {
    latest = Array.from(e.results)
      .map((r) => r[0].transcript)
      .join(" ")
      .trim();
    onText(latest);
  };
  rec.onerror = () => {};
  rec.onend = () => {
    if (finished) return;
    finished = true;
    if (!cancelled) onDone(latest);
  };
  try {
    rec.start();
  } catch {
    finished = true;
    onDone("");
  }
  return {
    stop: () => rec.stop(),
    cancel: () => {
      cancelled = true;
      rec.abort();
    },
  };
}

const VOICE_LANG: Record<Lang, string> = { en: "en-US", ms: "ms-MY", zh: "zh-CN" };

/** Say a short confirmation out loud, so the diner knows the tap worked. */
export function say(text: string, lang: Lang): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = VOICE_LANG[lang];
    u.rate = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {
    // Speaking is a nice-to-have; never block ordering on it.
  }
}

/* ---------- Recording a short clip for the server-side voice AI ---------- */

export function canRecord(): boolean {
  return (
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== "undefined"
  );
}

const MAX_CLIP_MS = 8000;

/**
 * Record one short spoken order. Stops by itself after 8 seconds, or when stop() is called.
 * onDone receives the audio, or null if the microphone was blocked or nothing was captured.
 */
export async function recordClip(onDone: (clip: Blob | null) => void): Promise<{ stop: () => void; cancel: () => void }> {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, noiseSuppression: true, echoCancellation: true, autoGainControl: true },
    });
  } catch {
    onDone(null);
    return { stop: () => {}, cancel: () => {} };
  }
  // Android Chrome records webm/opus; iPhone Safari records mp4/aac. Both are accepted by the server.
  const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t));
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 32000 } : undefined);
  const chunks: Blob[] = [];
  let cancelled = false;
  recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
  recorder.onstop = () => {
    clearTimeout(timer);
    stream.getTracks().forEach((t) => t.stop());
    const clip = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
    onDone(cancelled || clip.size < 1200 ? null : clip);
  };
  const stop = () => recorder.state !== "inactive" && recorder.stop();
  const timer = setTimeout(stop, MAX_CLIP_MS);
  recorder.start();
  return {
    stop,
    cancel: () => {
      cancelled = true;
      stop();
    },
  };
}

export function buzz(): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(80);
    } catch {
      // Not supported on this phone.
    }
  }
}
