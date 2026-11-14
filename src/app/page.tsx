"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { store } from "@/lib/store";
import { cleanTableCode } from "@/lib/types";

export default function Home() {
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const table = typed.trim() ? cleanTableCode(typed) : null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 p-6">
      <header className="mt-6">
        <p className="text-5xl font-bold tracking-tight text-primary">EZorder</p>
        <h1 className="mt-3 text-3xl font-bold leading-tight">
          One QR code on the table. A Big Photos Menu for those who want it, the Normal Menu for everyone else.
        </h1>
      </header>

      <section className="flex flex-col gap-3 rounded-3xl bg-porcelain p-5">
        <h2 className="text-xl font-bold">At a table?</h2>
        <label htmlFor="table-code" className="text-soft">
          Scan the QR code on your table, or type the table number printed on it
        </label>
        <div className="flex gap-2">
          <input
            id="table-code"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && table && router.push(`/t/${table}`)}
            maxLength={4}
            inputMode="numeric"
            autoComplete="off"
            className="min-h-16 min-w-0 flex-1 rounded-xl border-2 border-rule px-4 text-3xl font-bold uppercase"
          />
          <button
            onClick={() => table && router.push(`/t/${table}`)}
            disabled={!table}
            className="min-h-16 rounded-xl bg-primary px-6 text-xl font-bold text-ink active:bg-primary-press disabled:opacity-40"
          >
            Open menu
          </button>
        </div>
      </section>

      <nav className="flex flex-col gap-3 text-lg">
        <Link href="/demo" className="font-bold underline underline-offset-4">
          See both menus working at one table
        </Link>
        <Link href="/staff" className="font-bold underline underline-offset-4">
          Staff: print table QR cards, clear a table
        </Link>
        <p className="mt-2 text-base text-soft">
          {store.mode === "supabase"
            ? "Live sync is on: phones at the same table update each other."
            : "Sample-data mode: works in this browser. Add Supabase keys to sync real phones."}
        </p>
      </nav>
    </main>
  );
}
