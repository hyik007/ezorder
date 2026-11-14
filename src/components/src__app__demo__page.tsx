"use client";

import Link from "next/link";
import { useState } from "react";
import { TableCard } from "@/components/TableCard";
import { store } from "@/lib/store";

const TABLE = "5";

/** One table, one QR card, both menus: for pitching from a single laptop. */
export default function Demo() {
  const [round, setRound] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);

  async function clear() {
    setProblem(null);
    try {
      await store.clearTable(TABLE);
      setRound((r) => r + 1);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "Could not clear the table");
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-6">
      <header className="flex w-full max-w-5xl flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">One QR code, two menus, one order</h1>
          <p className="text-soft">
            Both phones scanned the same card. Tap “I want this” on the left and watch it land on the right.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void clear()} className="min-h-11 rounded-lg border-2 border-ink px-4 font-bold">
            Clear table {TABLE}
          </button>
          <Link href="/" className="flex min-h-11 items-center rounded-lg border-2 border-rule px-4 font-bold">
            Home
          </Link>
        </div>
      </header>

      {problem && (
        <p role="alert" className="rounded-lg bg-danger px-4 py-3 font-bold text-white">
          {problem}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-center gap-6">
        <Phone key={`easy-${round}`} label="Grandpa chose the Big Photos Menu" src={`/t/${TABLE}?menu=easy`} />
        <div className="flex flex-col items-center gap-2">
          <TableCard table={TABLE} size={120} />
          <p className="max-w-56 text-center text-soft">The only card on the table. Both phones scanned it.</p>
        </div>
        <Phone key={`normal-${round}`} label="His grandchild chose the Normal Menu" src={`/t/${TABLE}?menu=normal`} />
      </div>
    </main>
  );
}

function Phone({ label, src }: { label: string; src: string }) {
  return (
    <figure className="flex flex-col items-center gap-3">
      <figcaption className="text-lg font-bold">{label}</figcaption>
      <iframe
        src={src}
        title={label}
        allow="microphone"
        className="h-[min(760px,calc(100dvh-9rem))] w-[390px] max-w-full rounded-[2.5rem] border-[10px] border-ink bg-tabletop"
      />
    </figure>
  );
}
