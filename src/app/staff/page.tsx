"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TableCard } from "@/components/TableCard";
import { formatRM } from "@/lib/menu";
import { store } from "@/lib/store";
import type { MenuItem } from "@/lib/types";

const TABLES = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** For the restaurant: one card per table to print, and a way to reset a table after guests leave. */
export default function Staff() {
  const [cleared, setCleared] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuItem[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // The menu arrives live, so two staff phones see the same sold-out marks.
  useEffect(() => store.subscribeMenu(setMenu, setProblem), []);

  async function setStock(item: MenuItem, inStock: boolean) {
    setProblem(null);
    setBusy(item.id);
    try {
      await store.setStock(item.id, inStock);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "Could not change the menu");
    } finally {
      setBusy(null);
    }
  }

  async function clear(table: string) {
    setProblem(null);
    try {
      await store.clearTable(table);
      setCleared(table);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "Could not clear the table");
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-3 py-4 sm:gap-6 sm:p-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
      {/* Responsive Header: stacks cleanly on phones, side-by-side on tablet/desktop */}
      <header className="flex flex-col gap-3 sm:flex-row sm: flex-wrap sm:items-end sm:justify-between sm:gap-4 print:hidden">
        <div className="max-w-xl">
          <h1 className="text-2xl font-bold sm:text-3xl">Staff</h1>
          <p className="mt-1 text-base text-soft sm:text-lg leading-snug">
            Each table needs one card. Guests scan it and choose the Big Photos Menu or the Normal Menu on their own
            phone, so there is no second QR code to print or explain.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:w-auto">
          <button
            onClick={() => window.print()}
            className="min-h-11 sm:min-h-12 rounded-xl bg-ink px-4 sm:px-5 text-base sm:text-lg font-bold text-white active:opacity-90"
          >
            Print cards
          </button>
          <Link
            href="/"
            className="flex min-h-11 sm:min-h-12 items-center justify-center rounded-xl border-2 border-rule px-4 sm:px-5 text-base sm:text-lg font-bold active:bg-porcelain"
          >
            Home
          </Link>
        </div>
      </header>

      {/* Status Banner: collapses when empty so it doesn't waste vertical screen space on mobile */}
      <p
        role="status"
        aria-live="polite"
        className={`text-base sm:text-lg font-bold text-ink print:hidden ${
          problem || cleared ? "rounded-xl bg-porcelain px-3.5 py-2.5" : "sr-only"
        }`}
      >
        {problem ? (
          <span className="text-danger">{problem}</span>
        ) : cleared ? (
          `Table ${cleared} is cleared and ready for the next guests.`
        ) : (
          ""
        )}
      </p>

      {/* Sold Out Section: 1 column on phones, 2-column grid on tablets/desktops */}
      <section className="flex flex-col gap-3 print:hidden" aria-label="Sold out today">
        <div>
          <h2 className="text-xl font-bold sm:text-2xl">Sold out today</h2>
          <p className="mt-0.5 text-base text-soft sm:text-lg leading-snug">
            Tap a dish when the kitchen runs out. It disappears from the Big Photos Menu straight away, is
            marked on the Normal Menu, and voice ordering offers something similar instead.
          </p>
        </div>
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {(menu ?? []).map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-2.5 sm:gap-3 rounded-2xl bg-porcelain p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-bold leading-tight sm:text-lg">
                  {item.name.en}
                </p>
                <p className="text-sm text-soft sm:text-base">{formatRM(item.price)}</p>
              </div>
              <button
                onClick={() => void setStock(item, !item.inStock)}
                disabled={busy === item.id}
                aria-pressed={!item.inStock}
                className={`min-h-11 sm:min-h-12 shrink-0 rounded-xl border-2 px-3 sm:px-4 text-sm sm:text-base font-bold transition disabled:opacity-40 ${
                  item.inStock
                    ? "border-rule bg-porcelain text-ink"
                    : "border-ink bg-ink text-white"
                }`}
              >
                {item.inStock ? "Mark sold out" : "Sold out · restore"}
              </button>
            </li>
          ))}
          {menu === null && <li className="text-base sm:text-lg text-soft">Loading the menu…</li>}
        </ul>
      </section>

      {/* Table Cards Grid: responsive 1->2->3->4 columns on screen, flex layout when printing */}
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 md:grid-cols-3 lg:grid-cols-4 print:flex print:flex-wrap print:gap-6">
        {TABLES.map((table) => (
          <li
            key={table}
            className="flex break-inside-avoid flex-col items-center gap-2 rounded-2xl bg-porcelain/50 p-3 sm:bg-transparent sm:p-0"
          >
            <div className="w-full flex justify-center">
              <TableCard table={table} />
            </div>
            <div className="grid w-full max-w-[260px] grid-cols-2 gap-2 print:hidden">
              <Link
                href={`/t/${table}`}
                className="flex min-h-11 items-center justify-center rounded-lg border-2 border-rule px-3 text-sm sm:text-base font-bold active:bg-porcelain"
              >
                Open
              </Link>
              <button
                onClick={() => void clear(table)}
                className="min-h-11 rounded-lg border-2 border-rule px-3 text-sm sm:text-base font-bold active:bg-porcelain"
              >
                Clear table
              </button>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-sm sm:text-base text-soft print:hidden">
        A table also clears itself when nobody has ordered at it for 3 hours.
      </p>
    </main>
  );
}