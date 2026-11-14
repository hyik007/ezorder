"use client";

import { useRef, useState } from "react";
import { AppBar } from "./AppBar";
import { DishPhoto, Stages } from "./bits";
import { LangPicker } from "./LangPicker";
import { MicIcon, VoiceSheet } from "./VoiceSheet";
import { NAME_CHOICES, NOTE_LABEL, T } from "@/lib/i18n";
import { formatRM } from "@/lib/menu";
import { store } from "@/lib/store";
import type { Lang, Line, MenuItem, NewLine, TableState } from "@/lib/types";
import { kitchenStage, useNow } from "@/lib/useTable";
import { useStored } from "@/lib/useStored";
import { buzz, say, type ParsedItem } from "@/lib/voice";

export type MenuProps = {
  tableCode: string;
  table: TableState;
  menu: MenuItem[];
  myId: string;
  lang: Lang;
  setLang: (l: Lang) => void;
  onSwitch: () => void;
  /** Back to the menu chooser. Missing on /demo, where a menu is forced. */
  onBack?: () => void;
};

/**
 * The Big Photos Menu: one dish at a time, a big photo, one big button.
 * Picks go into the table's shared order. No cart maths, no login, no payment screen,
 * and the diner can always send the order alone.
 */
export function EasyMenu(props: MenuProps) {
  const { lang, setLang, onSwitch, onBack, tableCode } = props;
  const [name, setName, nameReady] = useStored<string>("ezorder:easy-name", "");
  const t = T[lang];

  if (!nameReady) return null;

  if (!name) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-4">
        <AppBar tableLabel={t.table(tableCode)} backLabel={t.backToChoice} onBack={onBack}>
          <LangPicker lang={lang} onPick={setLang} />
        </AppBar>
        <div className="mt-2">
          <h1 className="text-4xl font-bold leading-tight">{t.whoTitle}</h1>
          <p className="mt-2 text-2xl text-soft">{t.whoHelp}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {NAME_CHOICES.map((choice) => (
            <button
              key={choice}
              onClick={() => setName(choice)}
              className="min-h-24 rounded-2xl border-2 border-rule bg-porcelain px-3 text-2xl font-bold active:bg-oats"
            >
              {choice}
            </button>
          ))}
        </div>
        <button onClick={onSwitch} className="mt-auto min-h-14 rounded-2xl border-2 border-rule text-xl font-bold">
          {t.switchToNormal}
        </button>
      </main>
    );
  }

  return <Deck {...props} name={name} onChangeName={() => setName("")} />;
}

function Deck({
  tableCode,
  table,
  menu,
  myId,
  lang,
  setLang,
  onBack,
  name,
  onChangeName,
}: MenuProps & { name: string; onChangeName: () => void }) {
  const t = T[lang];

  // The deck only offers what the kitchen can actually cook today.
  const deck = menu.filter((m) => m.inStock);
  const [index, setIndex] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"picks" | "voice" | "send" | null>(null);
  const [seenOrderId, setSeenOrderId] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const busy = useRef(false);

  const myPicks = table.lines.filter(
    (l) => l.addedBy === myId && l.addedByName === name && l.orderId === null && l.qty > 0,
  );
  const pickCount = myPicks.reduce((sum, l) => sum + l.qty, 0);
  // Everything at the table that has not been sent yet, mine and other people's.
  const openLines = table.lines.filter((l) => l.orderId === null && l.qty > 0);
  const othersOrdering = openLines.some((l) => !(l.addedBy === myId && l.addedByName === name));
  const showOrder = table.order !== null && table.order.id !== seenOrderId;
  const now = useNow(showOrder);

  /** Add to the table's order, then confirm it three ways: sight, sound, touch. */
  async function add(lines: NewLine[], thenAdvance: boolean) {
    if (busy.current) return; // a second tap within a second is the same tap
    busy.current = true;
    setProblem(null);
    try {
      for (const line of lines) await store.addLine(tableCode, { id: myId, name }, line);
      const names = lines.map((l) => menu.find((m) => m.id === l.itemId)?.name[lang] ?? "").join(", ");
      buzz();
      say(`${t.added}. ${names}`, lang);
      setFlash(names);
      setTimeout(() => {
        setFlash(null);
        if (thenAdvance) setIndex((i) => Math.min(i + 1, deck.length));
        busy.current = false;
      }, 1300);
    } catch (e) {
      busy.current = false;
      setProblem(e instanceof Error ? e.message : "Could not add");
    }
  }

  function addFromVoice(items: ParsedItem[]) {
    setSheet(null);
    void add(
      items.map((i) => ({ itemId: i.itemId, qty: i.qty, notes: i.notes, source: "voice" as const, via: "easy" as const })),
      false,
    );
  }

  async function changeQty(line: Line, qty: number) {
    try {
      await store.setQty(tableCode, line.id, qty);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "Could not change");
    }
  }

  async function sendMyself() {
    setSheet(null);
    try {
      await store.confirmOrder(tableCode);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "Could not send");
    }
  }

  if (showOrder && table.order) {
    const { stage, ready } = kitchenStage(table.order.createdAt, now);
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 p-6">
        <div className="mt-6 flex flex-col items-center gap-4 text-center">
          <span className="stamp flex h-28 w-28 items-center justify-center rounded-full bg-success text-6xl text-white">
            ✓
          </span>
          <h1 className="text-4xl font-bold leading-tight">{t.orderSent}</h1>
        </div>
        <div className="rounded-3xl bg-porcelain p-6">
          <Stages labels={t.stages} stage={stage} ready={ready} large />
        </div>
        <button
          onClick={() => {
            setSeenOrderId(table.order!.id);
            setIndex(0);
          }}
          className="mt-auto min-h-20 rounded-2xl border-2 border-ink text-2xl font-bold"
        >
          {t.orderMore}
        </button>
      </main>
    );
  }

  const item = index < deck.length ? deck[index] : null;
  const alreadyPicked = item ? myPicks.filter((l) => l.itemId === item.id).reduce((s, l) => s + l.qty, 0) : 0;

  const addedOverlay = flash !== null && (
    <div
      role="status"
      className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-success p-6 text-center text-white"
    >
      <span className="stamp text-8xl leading-none">✓</span>
      <p className="text-4xl font-bold">{t.added}</p>
      <p className="text-3xl">{flash}</p>
      <p className="mt-2 text-xl opacity-90">{t.addedToTable}</p>
    </div>
  );

  return (
    <main className="mx-auto flex h-dvh w-full max-w-md flex-col gap-3 p-4">
      <AppBar tableLabel={t.table(tableCode)} backLabel={t.backToChoice} onBack={onBack}>
        <LangPicker lang={lang} onPick={setLang} />
      </AppBar>

      {item ? (
        <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl bg-porcelain">
          <div className="relative min-h-36 flex-1">
            <DishPhoto item={item} alt={item.name[lang]} sizes="(max-width: 448px) 100vw, 448px" priority />
            {alreadyPicked > 0 && (
              <span className="absolute left-3 top-3 rounded-full bg-success px-4 py-1.5 text-2xl font-bold text-white">
                ✓ ×{alreadyPicked}
              </span>
            )}
          </div>
          <div className="p-4">
            <p className="text-lg text-soft">{t.dishOf(index + 1, deck.length)}</p>
            <h1 className="text-4xl font-bold leading-tight">{item.name[lang]}</h1>
            <div className="mt-1 flex items-end justify-between gap-3">
              <p className="text-xl leading-snug text-soft">{item.desc[lang]}</p>
              <p className="shrink-0 text-3xl font-bold">{formatRM(item.price)}</p>
            </div>
          </div>
          {addedOverlay}
        </section>
      ) : (
        <section className="relative flex min-h-0 flex-1 flex-col justify-center gap-4 overflow-hidden rounded-3xl bg-porcelain p-6 text-center">
          <h1 className="text-4xl font-bold leading-tight">{t.seenAll}</h1>
          <p className="text-2xl leading-snug text-soft">{othersOrdering ? t.payNoteGroup : t.payNote}</p>
          {addedOverlay}
        </section>
      )}

      {problem && (
        <p role="alert" className="rounded-xl bg-danger px-4 py-3 text-xl font-bold text-white">
          {problem}
        </p>
      )}

      {item ? (
        <>
          <button
            onClick={() => void add([{ itemId: item.id, qty: 1, notes: [], source: "tap", via: "easy" }], true)}
            className="min-h-20 rounded-2xl bg-primary text-3xl font-bold text-ink active:bg-primary-press"
          >
            ✓ {t.want}
          </button>
          <div className="grid grid-cols-[1fr_2fr] gap-3">
            <button
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              className="min-h-16 rounded-2xl border-2 border-rule bg-porcelain text-xl font-bold disabled:opacity-40"
            >
              {t.back}
            </button>
            <button
              onClick={() => setIndex((i) => i + 1)}
              className="min-h-16 rounded-2xl border-2 border-ink bg-porcelain text-2xl font-bold"
            >
              {t.next}
            </button>
          </div>
        </>
      ) : (
        <>
          {/* The end of the menu is a natural place to finish, so the way out is right here. */}
          {openLines.length > 0 && (
            <button
              onClick={() => setSheet("send")}
              className="min-h-20 rounded-2xl bg-primary text-3xl font-bold text-ink active:bg-primary-press"
            >
              {t.send}
            </button>
          )}
          <button
            onClick={() => setIndex(0)}
            className="min-h-16 rounded-2xl border-2 border-ink bg-porcelain text-2xl font-bold"
          >
            {t.lookAgain}
          </button>
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setSheet("picks")}
          className="flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-ink px-2 text-xl font-bold text-white"
        >
          {t.myPicks}
          <span className="rounded-full bg-white px-3 text-ink">{pickCount}</span>
        </button>
        <button
          onClick={() => setSheet("voice")}
          className="flex min-h-16 items-center justify-center gap-2 rounded-2xl border-2 border-ink bg-porcelain px-2 text-xl font-bold leading-tight text-ink"
        >
          <MicIcon className="h-7 w-7 shrink-0 text-primary" />
          {t.speak}
        </button>
      </div>

      {sheet === "voice" && (
        <VoiceSheet lang={lang} menu={menu} tableCode={tableCode} onAdd={addFromVoice} onClose={() => setSheet(null)} />
      )}

      {sheet === "picks" && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.myPicks}
          className="fixed inset-0 z-30 flex flex-col gap-4 overflow-y-auto bg-tabletop p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-4xl font-bold">{t.myPicks}</h2>
            <button
              onClick={() => {
                setSheet(null);
                onChangeName();
              }}
              className="min-h-12 max-w-[45%] truncate rounded-xl border-2 border-rule bg-porcelain px-3 text-lg font-bold"
              aria-label={`${name}. ${t.changeName}`}
            >
              {name}
            </button>
          </div>
          {myPicks.length === 0 ? (
            <p className="flex-1 text-2xl leading-snug text-soft">{t.nothingYet}</p>
          ) : (
            <ul className="flex flex-1 flex-col gap-3">
              {myPicks.map((line) => {
                const dish = menu.find((m) => m.id === line.itemId);
                if (!dish) return null;
                return (
                  <li key={line.id} className="flex items-center gap-3 rounded-2xl bg-porcelain p-3">
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                      <DishPhoto item={dish} alt="" sizes="64px" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-2xl font-bold leading-tight">{dish.name[lang]}</p>
                      {line.notes.length > 0 && (
                        <p className="text-lg text-soft">{line.notes.map((n) => NOTE_LABEL[n][lang]).join(", ")}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => void changeQty(line, line.qty - 1)}
                        aria-label={`${t.remove}: ${dish.name[lang]}`}
                        className="h-14 w-14 rounded-full border-2 border-ink text-3xl font-bold leading-none"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-3xl font-bold">{line.qty}</span>
                      <button
                        onClick={() => void changeQty(line, line.qty + 1)}
                        aria-label={`${t.oneMore}: ${dish.name[lang]}`}
                        className="h-14 w-14 rounded-full bg-primary text-3xl font-bold leading-none text-ink"
                      >
                        +
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="rounded-2xl bg-oats p-4 text-xl leading-snug">{othersOrdering ? t.payNoteGroup : t.payNote}</p>
          {openLines.length > 0 && (
            <button
              onClick={() => setSheet("send")}
              className="min-h-20 rounded-2xl bg-primary text-2xl font-bold text-ink active:bg-primary-press"
            >
              {t.send}
            </button>
          )}
          <button onClick={() => setSheet(null)} className="min-h-16 rounded-2xl border-2 border-ink bg-porcelain text-2xl font-bold">
            {t.close}
          </button>
        </div>
      )}

      {/* Solo ordering: nobody has to wait for a "group leader". One question, then it is sent. */}
      {sheet === "send" && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="alone-title"
          className="fixed inset-0 z-30 flex flex-col justify-center gap-5 bg-porcelain p-6"
        >
          <h2 id="alone-title" className="text-4xl font-bold leading-tight">
            {t.aloneTitle}
          </h2>
          <ul className="flex flex-col gap-1 rounded-2xl bg-tabletop p-4 text-2xl font-bold">
            {openLines.map((l) => (
              <li key={l.id} className="flex justify-between gap-3">
                <span className="min-w-0 truncate">{menu.find((m) => m.id === l.itemId)?.name[lang] ?? l.itemId}</span>
                <span>×{l.qty}</span>
              </li>
            ))}
          </ul>
          <p className="text-2xl leading-snug text-soft">{t.aloneHelp}</p>
          <button
            onClick={() => void sendMyself()}
            className="mt-4 min-h-20 rounded-2xl bg-primary text-2xl font-bold text-ink"
          >
            ✓ {t.yesSend}
          </button>
          <button onClick={() => setSheet("picks")} className="min-h-20 rounded-2xl border-2 border-ink text-2xl font-bold">
            {t.notYet}
          </button>
        </div>
      )}
    </main>
  );
}
