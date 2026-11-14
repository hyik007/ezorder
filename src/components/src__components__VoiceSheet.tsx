"use client";

import { useEffect, useRef, useState } from "react";
import { DishPhoto } from "./bits";
import { NOTE_LABEL, T } from "@/lib/i18n";
import { logVoiceFeedback } from "@/lib/store/supabase";
import type { Lang, MenuItem } from "@/lib/types";
import { askVoice, voiceEngine, type VoiceReply } from "@/lib/voiceClient";
import { SPEECH_LANGS, canListen, canRecord, listen, parseOrder, recordClip, replacementsFor, suggestDishes, type ParsedItem } from "@/lib/voice";

/*
  Voice ordering, one step at a time. Nothing is added until the diner says yes.

    ready ──tap mic──> listening ──> thinking ──> confirm ──Yes──> added
                                         │            │
                                         │            └─"Choose from photos"─> pick
                                         └─ nothing matched ───────────────────> pick
    pick: "Did you mean…?" dishes first, then every dish. Tap one -> confirm.

  Engines:
    ILMU (YTL AI Labs) when the server has a key: the phone records, /api/voice does the rest,
      and the diner never has to choose a language.
    The phone's own speech recogniser otherwise, or when ILMU is unreachable. It listens in one
      language at a time, so the diner picks it.
*/

type Phase =
  | { name: "ready"; hint?: string }
  | { name: "listening"; text: string }
  | { name: "thinking"; text: string }
  | {
      name: "confirm";
      heard: string;
      draft: ParsedItem[];
      proposed: ParsedItem[];
      engine: string;
      manual?: boolean;
      /** Dishes the diner asked for that have run out, named on the confirm screen. */
      soldOut?: string[];
      /** The AI's own short line, in the language the diner spoke. */
      message?: string;
    }
  | {
      name: "pick";
      heard: string;
      suggestions: string[];
      draft: ParsedItem[];
      proposed: ParsedItem[];
      engine: string;
      soldOut?: string[];
      message?: string;
    };

type Session = { stop: () => void; cancel: () => void };

export function VoiceSheet({
  lang,
  menu,
  tableCode,
  onAdd,
  onClose,
}: {
  lang: Lang;
  menu: MenuItem[];
  tableCode: string;
  onAdd: (items: ParsedItem[]) => void;
  onClose: () => void;
}) {
  const t = T[lang];
  const speechLangs = SPEECH_LANGS[lang];
  const [engine, setEngine] = useState<"checking" | "ilmu" | "browser">("checking");
  const [speechCode, setSpeechCode] = useState(speechLangs[0].code);
  const [phase, setPhase] = useState<Phase>({ name: "ready" });
  const [typed, setTyped] = useState("");
  const session = useRef<Session | null>(null);

  useEffect(() => {
    let live = true;
    void voiceEngine().then((e) => live && setEngine(e === "ilmu" && canRecord() ? "ilmu" : "browser"));
    return () => {
      live = false;
      session.current?.cancel();
    };
  }, []);

  const recording = engine === "ilmu";
  const micWorks = recording || canListen();
  const dish = (id: string) => menu.find((m) => m.id === id);

  /**
   * Show what was understood. Anything the diner can still order goes to the confirm screen;
   * a sold-out dish is named there with replacements to tap. Nothing matched -> straight to choosing.
   */
  function show(reply: Pick<VoiceReply, "heard" | "items" | "soldOut" | "suggestions" | "message" | "engine">) {
    const known = reply.items.filter((i) => dish(i.itemId) && dish(i.itemId)!.inStock);
    const soldOut = reply.soldOut.filter((id) => dish(id));
    const suggestions = reply.suggestions.filter((id) => dish(id)?.inStock);
    const common = { heard: reply.heard, engine: reply.engine, soldOut, message: reply.message };
    if (known.length > 0) {
      setPhase({ name: "confirm", ...common, draft: known, proposed: known });
    } else {
      setPhase({
        name: "pick",
        ...common,
        suggestions: suggestions.length > 0 ? suggestions : suggestDishes(reply.heard, menu),
        draft: [],
        proposed: [],
      });
    }
  }

  /** The built-in matcher has no stock or message of its own, so wrap its answer in the same shape. */
  function showLocal(heard: string, engine: string) {
    const matched = parseOrder(heard, menu);
    const soldOut = matched.filter((i) => dish(i.itemId) && !dish(i.itemId)!.inStock).map((i) => i.itemId);
    show({
      heard,
      items: matched.filter((i) => dish(i.itemId)?.inStock),
      soldOut,
      suggestions: replacementsFor(soldOut, menu),
      message: "",
      engine,
    });
  }

  /** The ILMU engine stopped answering: carry on with the phone's own recogniser. */
  function fallBack() {
    setEngine("browser");
    setPhase({ name: "ready", hint: t.aiFallback });
  }

  async function understandText(text: string) {
    const words = text.trim();
    if (!words) return setPhase({ name: "ready" });
    setPhase({ name: "thinking", text: words });
    if (recording) {
      const reply = await askVoice({ text: words });
      if (reply) return show({ ...reply, heard: reply.heard || words });
    }
    showLocal(words, "on-phone");
  }

  async function understandClip(clip: Blob | null) {
    if (!clip) return setPhase({ name: "ready", hint: t.voiceFailed });
    setPhase({ name: "thinking", text: "" });
    const reply = await askVoice({ clip });
    if (!reply) return fallBack();
    if (!reply.heard) return setPhase({ name: "ready", hint: t.voiceFailed });
    show(reply);
  }

  async function startListening() {
    setPhase({ name: "listening", text: "" });
    session.current = recording
      ? await recordClip((clip) => void understandClip(clip))
      : listen(
          speechCode,
          (text) => setPhase({ name: "listening", text }),
          (finalText) => void understandText(finalText),
        );
  }

  function close() {
    session.current?.cancel();
    onClose();
  }

  function changeQty(itemId: string, delta: number) {
    if (phase.name !== "confirm") return;
    const draft = phase.draft
      .map((d) => (d.itemId === itemId ? { ...d, qty: Math.min(10, d.qty + delta) } : d))
      .filter((d) => d.qty > 0);
    if (draft.length === 0) return openPicker();
    setPhase({ ...phase, draft });
  }

  function openPicker() {
    if (phase.name !== "confirm") return;
    setPhase({
      name: "pick",
      heard: phase.heard,
      suggestions: suggestDishes(phase.heard, menu).filter((id) => !phase.draft.some((d) => d.itemId === id)),
      draft: phase.draft,
      proposed: phase.proposed,
      engine: phase.engine,
      soldOut: phase.soldOut,
      message: phase.message,
    });
  }

  function pick(itemId: string) {
    if (phase.name !== "pick") return;
    const has = phase.draft.some((d) => d.itemId === itemId);
    const draft = has
      ? phase.draft.map((d) => (d.itemId === itemId ? { ...d, qty: Math.min(10, d.qty + 1) } : d))
      : [...phase.draft, { itemId, qty: 1, notes: [] }];
    setPhase({
      name: "confirm",
      heard: phase.heard,
      draft,
      proposed: phase.proposed,
      engine: phase.engine,
      manual: true,
      soldOut: phase.soldOut,
      message: phase.message,
    });
  }

  function accept() {
    if (phase.name !== "confirm") return;
    const asProposed =
      phase.draft.length === phase.proposed.length &&
      phase.draft.every((d) => phase.proposed.some((p) => p.itemId === d.itemId && p.qty === d.qty));
    if (phase.heard) {
      logVoiceFeedback({
        table: tableCode,
        heard: phase.heard,
        proposed: phase.proposed.map((p) => ({ itemId: p.itemId, qty: p.qty })),
        chosen: asProposed ? undefined : phase.draft.map((d) => ({ itemId: d.itemId, qty: d.qty })),
        accepted: asProposed,
        engine: phase.engine,
      });
    }
    onAdd(phase.draft);
  }

  const big = "min-h-20 rounded-2xl text-2xl font-bold";
  const plain = `${big} border-2 border-ink bg-porcelain text-ink`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.speak}
      className="fixed inset-0 z-30 flex flex-col overflow-y-auto pt-[calc(1.25rem+var(--safe-top))] pb-[var(--safe-bottom)] px-5 md:inset-x-auto md:left-1/2 md:w-[36rem] md:-translate-x-1/2 md:shadow-2xl gap-5 bg-porcelain short:gap-3"
    >
      {(phase.name === "ready" || phase.name === "listening") && (
        <>
          <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
            {engine === "checking" ? (
              <p className="text-2xl text-soft">…</p>
            ) : micWorks ? (
              <>
                <button
                  onClick={phase.name === "ready" ? () => void startListening() : () => session.current?.stop()}
                  aria-label={phase.name === "ready" ? t.speak : t.stopListening}
                  className={`flex h-40 w-40 shrink-0 items-center justify-center rounded-full bg-primary text-ink short:h-28 short:w-28 tiny:h-24 tiny:w-24 ${
                    phase.name === "listening" ? "hearing" : ""
                  }`}
                >
                  <MicIcon className="h-20 w-20 short:h-14 short:w-14" />
                </button>
                <p className="text-3xl font-bold leading-tight">
                  {phase.name === "listening" ? (recording ? t.recording : t.listening) : t.speak}
                </p>
                {phase.name === "listening" && !recording && (
                  <p className="min-h-10 text-2xl text-soft" aria-live="polite">
                    {phase.text}
                  </p>
                )}
                {phase.name === "ready" && phase.hint && (
                  <p role="alert" className="rounded-2xl bg-oats p-4 text-xl font-bold leading-snug">
                    {phase.hint}
                  </p>
                )}
                {/* Only the phone's own recogniser needs a language. ILMU takes mixed speech. */}
                {phase.name === "ready" && !recording && speechLangs.length > 1 && (
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-lg text-soft">{t.speechLang}</p>
                    <div className="flex gap-2">
                      {speechLangs.map((s) => (
                        <button
                          key={s.code}
                          onClick={() => setSpeechCode(s.code)}
                          aria-pressed={speechCode === s.code}
                          className={`min-h-14 rounded-xl border-2 px-4 text-xl font-bold ${
                            speechCode === s.code ? "border-ink bg-ink text-white" : "border-rule bg-porcelain text-ink"
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-2xl font-bold">{t.noMic}</p>
            )}
          </div>

          {phase.name === "listening" ? (
            <button onClick={() => session.current?.stop()} className={`${big} bg-primary text-ink`}>
              {t.stopListening}
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <label htmlFor="typed-order" className="text-lg text-soft">
                {t.typeInstead}
              </label>
              <div className="flex gap-2">
                <input
                  id="typed-order"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void understandText(typed)}
                  placeholder={t.typePlaceholder}
                  className="min-h-16 min-w-0 flex-1 rounded-xl border-2 border-rule px-4 text-xl"
                />
                <button
                  onClick={() => void understandText(typed)}
                  disabled={!typed.trim()}
                  className="min-h-16 rounded-xl bg-ink px-5 text-xl font-bold text-white disabled:opacity-40"
                >
                  {t.find}
                </button>
              </div>
            </div>
          )}
          <button onClick={close} className="min-h-16 rounded-2xl border-2 border-rule text-2xl font-bold">
            {t.cancel}
          </button>
        </>
      )}

      {phase.name === "thinking" && (
        <div className="flex flex-1 items-center justify-center text-center" role="status">
          <p className="text-3xl font-bold">{phase.text ? `“${phase.text}”` : "…"}</p>
        </div>
      )}

      {phase.name === "confirm" && (
        <>
          {!phase.manual && <Heard phase={phase} menu={menu} lang={lang} />}
          <ul className="flex flex-1 flex-col gap-3">
            {phase.draft.map((p) => {
              const item = dish(p.itemId)!;
              return (
                <li key={p.itemId} className="flex items-center gap-3 rounded-2xl bg-oats p-3">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl">
                    <DishPhoto item={item} alt="" sizes="80px" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-2xl font-bold leading-tight">{item.name[lang]}</p>
                    {p.notes.length > 0 && (
                      <p className="text-lg text-soft">{p.notes.map((n) => NOTE_LABEL[n][lang]).join(", ")}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => changeQty(p.itemId, -1)}
                      aria-label={`${t.remove}: ${item.name[lang]}`}
                      className="h-12 w-12 rounded-full border-2 border-ink bg-porcelain text-2xl font-bold leading-none"
                    >
                      −
                    </button>
                    <span className="w-7 text-center text-2xl font-bold">{p.qty}</span>
                    <button
                      onClick={() => changeQty(p.itemId, 1)}
                      aria-label={`${t.oneMore}: ${item.name[lang]}`}
                      className="h-12 w-12 rounded-full border-2 border-ink bg-porcelain text-2xl font-bold leading-none"
                    >
                      +
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="text-center text-3xl font-bold">{phase.manual ? t.addThese : t.isThisRight}</p>
          <button onClick={accept} className={`${big} bg-primary text-ink active:bg-primary-press`}>
            ✓ {t.yesAdd}
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={openPicker} className={`${plain} px-2 text-xl`}>
              {t.chooseAnother}
            </button>
            <button onClick={() => setPhase({ name: "ready" })} className={`${plain} px-2 text-xl`}>
              {t.sayAgain}
            </button>
          </div>
        </>
      )}

      {phase.name === "pick" && (
        <>
          {phase.draft.length === 0 && <Heard phase={phase} menu={menu} lang={lang} />}
          {phase.suggestions.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-3xl font-bold leading-tight">
                {(phase.soldOut ?? []).length > 0 ? t.tryInstead : t.didYouMean}
              </h2>
              <DishGrid ids={phase.suggestions} menu={menu} lang={lang} onPick={pick} />
            </section>
          )}
          <section className="flex flex-col gap-3">
            <h2 className="text-2xl font-bold">{phase.suggestions.length > 0 ? t.allDishes : t.tapToAdd}</h2>
            <DishGrid
              ids={menu.filter((m) => m.inStock).map((m) => m.id).filter((id) => !phase.suggestions.includes(id))}
              menu={menu}
              lang={lang}
              onPick={pick}
            />
          </section>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setPhase({ name: "ready" })} className={`${plain} px-2 text-xl`}>
              {t.sayAgain}
            </button>
            <button onClick={close} className="min-h-20 rounded-2xl border-2 border-rule px-2 text-xl font-bold">
              {t.cancel}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** What the AI heard, its own warm line, and anything that has run out. */
function Heard({
  phase,
  menu,
  lang,
}: {
  phase: Extract<Phase, { name: "confirm" | "pick" }>;
  menu: MenuItem[];
  lang: Lang;
}) {
  const t = T[lang];
  const gone = (phase.soldOut ?? [])
    .map((id) => menu.find((m) => m.id === id)?.name[lang])
    .filter((n): n is string => Boolean(n));
  if (!phase.heard && gone.length === 0 && !phase.message) return null;
  return (
    <div className="flex flex-col gap-3">
      {phase.heard && (
        <div>
          <p className="text-lg text-soft">{t.heard}</p>
          <p className="text-2xl font-bold">“{phase.heard}”</p>
        </div>
      )}
      {gone.length > 0 && (
        <p role="alert" className="rounded-2xl bg-oats p-4 text-2xl font-bold leading-snug">
          {t.soldOutIs(gone.join(", "))}
        </p>
      )}
      {/* The AI answers in the diner's own language, so it is shown as written. */}
      {phase.message && <p className="text-xl leading-snug text-soft">{phase.message}</p>}
    </div>
  );
}

function DishGrid({
  ids,
  menu,
  lang,
  onPick,
}: {
  ids: string[];
  menu: MenuItem[];
  lang: Lang;
  onPick: (id: string) => void;
}) {
  return (
    <ul className="grid grid-cols-2 gap-3">
      {ids.map((id) => {
        const item = menu.find((m) => m.id === id);
        if (!item) return null;
        return (
          <li key={id}>
            <button
              onClick={() => onPick(id)}
              className="flex w-full flex-col overflow-hidden rounded-2xl border-2 border-rule bg-porcelain text-left active:border-primary"
            >
              <span className="relative block aspect-[4/3] w-full">
                <DishPhoto item={item} alt="" sizes="(max-width: 448px) 50vw, 224px" />
              </span>
              <span className="p-3 text-2xl font-bold leading-tight">{item.name[lang]}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function MicIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className} aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}
