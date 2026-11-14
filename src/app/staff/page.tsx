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
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div className="max-w-xl">
          <h1 className="text-3xl font-bold">Staff</h1>
          <p className="mt-1 text-lg text-soft">
            Each table needs one card. Guests scan it and choose the Big Photos Menu or the Normal Menu on their own
            phone, so there is no second QR code to print or explain.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="min-h-12 rounded-xl bg-ink px-5 text-lg font-bold text-white">
            Print cards
          </button>
          <Link href="/" className="flex min-h-12 items-center rounded-xl border-2 border-rule px-5 text-lg font-bold">
            Home
          </Link>
        </div>
      </header>

      <p role="status" className="min-h-7 text-lg font-bold text-ink print:hidden">
        {problem ? <span className="text-danger">{problem}</span> : cleared ? `Table ${cleared} is cleared and ready for the next guests.` : ""}
      </p>

      <section className="flex flex-col gap-3 print:hidden" aria-label="Sold out today">
        <div>
          <h2 className="text-2xl font-bold">Sold out today</h2>
          <p className="text-lg text-soft">
            Tap a dish when the kitchen runs out. It disappears from the Big Photos Menu straight away, is
            marked on the Normal Menu, and voice ordering offers something similar instead.
          </p>
        </div>
        <ul className="flex flex-col gap-2">
          {(menu ?? []).map((item) => (
            <li key={item.id} className="flex items-center gap-3 rounded-2xl bg-porcelain p-3">
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold leading-tight">{item.name.en}</p>
                <p className="text-soft">{formatRM(item.price)}</p>
              </div>
              <button
                onClick={() => void setStock(item, !item.inStock)}
                disabled={busy === item.id}
                aria-pressed={!item.inStock}
                className={`min-h-12 min-w-36 rounded-xl border-2 px-4 font-bold disabled:opacity-40 ${
                  item.inStock ? "border-rule bg-porcelain text-ink" : "border-ink bg-ink text-white"
                }`}
              >
                {item.inStock ? "Mark sold out" : "Sold out · tap to restore"}
              </button>
            </li>
          ))}
          {menu === null && <li className="text-lg text-soft">Loading the menu…</li>}
        </ul>
      </section>

      <ul className="flex flex-wrap gap-6">
        {TABLES.map((table) => (
          <li key={table} className="flex break-inside-avoid flex-col items-center gap-2">
            <TableCard table={table} />
            <div className="flex gap-2 print:hidden">
              <Link
                href={`/t/${table}`}
                className="flex min-h-11 items-center rounded-lg border-2 border-rule px-3 font-bold"
              >
                Open
              </Link>
              <button onClick={() => void clear(table)} className="min-h-11 rounded-lg border-2 border-rule px-3 font-bold">
                Clear table
              </button>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-soft print:hidden">
        A table also clears itself when nobody has ordered at it for 3 hours.
      </p>
    </main>
  );
}
