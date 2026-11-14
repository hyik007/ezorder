"use client";

import { useState } from "react";
import { AppBar } from "./AppBar";
import { DishPhoto, Stages } from "./bits";
import type { MenuProps } from "./EasyMenu";
import { LangPicker } from "./LangPicker";
import { NOTE_LABEL, T } from "@/lib/i18n";
import { CATEGORIES, formatRM } from "@/lib/menu";
import { store } from "@/lib/store";
import { kitchenStage, useNow } from "@/lib/useTable";
import { useStored } from "@/lib/useStored";

/**
 * The normal menu: the full list, the whole table's order, and the "Send to kitchen" button.
 * Picks made on easy-menu phones at the same table land here as they happen.
 */
export function NormalMenu({ tableCode, table, menu, myId, lang, setLang, onSwitch, onBack }: MenuProps) {
  const t = T[lang];
  const [savedName, saveName] = useStored<string>("ezorder:normal-name", "");
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const now = useNow(table.order !== null);

  const myName = savedName.trim() || t.guest;
  const dish = (id: string) => menu.find((m) => m.id === id);

  const open = table.lines.filter((l) => l.orderId === null && l.qty > 0);
  const total = open.reduce((sum, l) => sum + l.qty * (dish(l.itemId)?.price ?? 0), 0);
  const itemCount = open.reduce((n, l) => n + l.qty, 0);
  // Group by who picked: the same name on two phones is still two people.
  const people = [...new Map(open.map((l) => [`${l.addedBy}:${l.addedByName}`, l.addedByName])).entries()];
  const ordered = table.order ? table.lines.filter((l) => l.orderId === table.order!.id) : [];
  const myPlainLine = (itemId: string) =>
    open.find((l) => l.itemId === itemId && l.addedBy === myId && l.addedByName === myName && l.notes.length === 0);

  async function run(action: () => Promise<void>) {
    setProblem(null);
    try {
      await action();
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  async function send() {
    setSending(true);
    await run(() => store.confirmOrder(tableCode));
    setSending(false);
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 p-4 pb-44">
      <AppBar tableLabel={t.table(tableCode)} backLabel={t.backToChoice} onBack={onBack}>
        <LangPicker lang={lang} onPick={setLang} />
      </AppBar>
      <div className="flex flex-col gap-3">
        <div className="flex items-stretch gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-porcelain px-3">
            <span className="shrink-0 text-soft">{t.yourName}</span>
            <input
              value={savedName}
              onChange={(e) => saveName(e.target.value.slice(0, 40))}
              placeholder={t.guest}
              autoComplete="given-name"
              className="min-h-12 min-w-0 flex-1 bg-transparent text-lg font-bold outline-none placeholder:font-normal"
            />
          </label>
          <button onClick={onSwitch} className="min-h-12 rounded-xl border-2 border-ink bg-porcelain px-3 font-bold text-ink">
            {t.switchToEasy}
          </button>
        </div>
      </div>

      {table.order && (
        <section className="rounded-2xl bg-porcelain p-4" aria-label={t.sent}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-xl font-bold">{t.sent}</h2>
            <p className="text-xl font-bold">{formatRM(table.order.total)}</p>
          </div>
          <p className="mb-3 text-soft">
            {ordered.map((l) => `${l.qty} × ${dish(l.itemId)?.name[lang] ?? l.itemId}`).join(", ")}
          </p>
          <Stages labels={t.stages} {...kitchenStage(table.order.createdAt, now)} />
        </section>
      )}

      <section aria-label={t.tableOrder} className="flex flex-col gap-2">
        <h2 className="text-xl font-bold">{t.tableOrder}</h2>
        {open.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-rule p-6 text-center text-lg text-soft">
            {table.order ? t.nothingNew : t.emptyCart}
          </p>
        ) : (
          people.map(([key, person]) => (
            <div key={key} className="overflow-hidden rounded-2xl bg-porcelain">
              <h3 className="border-b border-rule px-4 py-2 text-lg font-bold">{person}</h3>
              <ul>
                {open
                  .filter((l) => `${l.addedBy}:${l.addedByName}` === key)
                  .map((line) => {
                    const d = dish(line.itemId);
                    const detail = [
                      ...line.notes.map((n) => NOTE_LABEL[n][lang]),
                      line.source === "voice" ? t.byVoice : null,
                    ].filter(Boolean);
                    return (
                      // "arrive" makes a pick glow yellow for a moment when it lands from another phone.
                      <li key={line.id} className="arrive flex items-center gap-3 border-b border-rule px-4 py-3 last:border-b-0">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold leading-tight">{d?.name[lang] ?? line.itemId}</p>
                          <p className="text-sm text-soft">
                            {[...detail, formatRM((d?.price ?? 0) * line.qty)].join(", ")}
                          </p>
                        </div>
                        <Stepper
                          qty={line.qty}
                          label={d?.name[lang] ?? line.itemId}
                          onQty={(qty) => void run(() => store.setQty(tableCode, line.id, qty))}
                        />
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))
        )}
      </section>

      <section aria-label={t.menu} className="flex flex-col gap-2">
        <h2 className="text-xl font-bold">{t.menu}</h2>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label={t.menu}>
          {[{ id: null, label: t.all }, ...CATEGORIES.map((c) => ({ id: c.id as string | null, label: c.label[lang] }))].map(
            (c) => (
              <button
                key={c.id ?? "all"}
                onClick={() => setCategory(c.id)}
                aria-pressed={category === c.id}
                className={`min-h-11 shrink-0 rounded-full px-5 font-bold ${
                  category === c.id ? "bg-primary text-ink" : "bg-porcelain text-ink"
                }`}
              >
                {c.label}
              </button>
            ),
          )}
        </div>
        <ul className="overflow-hidden rounded-2xl bg-porcelain">
          {menu
            .filter((item) => category === null || item.category === category)
            .map((item) => {
            const mine = myPlainLine(item.id);
            return (
              <li
                key={item.id}
                className={`flex items-center gap-3 border-b border-rule p-3 last:border-b-0 ${
                  item.inStock ? "" : "opacity-55"
                }`}
              >
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-tabletop">
                  <DishPhoto item={item} alt="" sizes="64px" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold leading-tight">{item.name[lang]}</p>
                  <p className="text-sm leading-snug text-soft">{item.desc[lang]}</p>
                  <p className="font-bold">{formatRM(item.price)}</p>
                </div>
                {!item.inStock ? (
                  <span className="shrink-0 rounded-full bg-tabletop px-4 py-2 font-bold text-soft">{t.soldOut}</span>
                ) : mine ? (
                  <Stepper
                    qty={mine.qty}
                    label={item.name[lang]}
                    onQty={(qty) => void run(() => store.setQty(tableCode, mine.id, qty))}
                  />
                ) : (
                  <button
                    onClick={() =>
                      void run(() =>
                        store.addLine(tableCode, { id: myId, name: myName }, { itemId: item.id, qty: 1, notes: [], source: "tap", via: "normal" }),
                      )
                    }
                    aria-label={`${t.add}: ${item.name[lang]}`}
                    className="min-h-11 rounded-full bg-primary px-5 font-bold text-ink active:bg-primary-press"
                  >
                    + {t.add}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <footer className="fixed inset-x-0 bottom-0 border-t border-rule bg-porcelain">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-2 p-4">
          {problem && (
            <p role="alert" className="rounded-lg bg-danger px-3 py-2 font-bold text-white">
              {problem}
            </p>
          )}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-soft">{open.length === 0 ? t.nothingToSend : t.itemsFrom(itemCount, people.length)}</p>
              <p className="text-2xl font-bold">{formatRM(total)}</p>
            </div>
            <button
              onClick={() => void send()}
              disabled={open.length === 0 || sending}
              className="min-h-14 rounded-xl bg-primary px-5 text-lg font-bold text-ink active:bg-primary-press disabled:opacity-40"
            >
              {sending ? t.sending : t.send}
            </button>
          </div>
          <p className="text-sm text-soft">{t.payAfter}</p>
        </div>
      </footer>
    </main>
  );
}

function Stepper({ qty, label, onQty }: { qty: number; label: string; onQty: (qty: number) => void }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button
        onClick={() => onQty(qty - 1)}
        aria-label={`− ${label}`}
        className="h-11 w-11 rounded-full border-2 border-rule text-2xl font-bold leading-none"
      >
        −
      </button>
      <span className="w-6 text-center text-xl font-bold">{qty}</span>
      <button
        onClick={() => onQty(qty + 1)}
        disabled={qty >= 20}
        aria-label={`+ ${label}`}
        className="h-11 w-11 rounded-full border-2 border-rule text-2xl font-bold leading-none disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}
