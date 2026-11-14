"use client";

import Image from "next/image";
import { AppBar } from "./AppBar";
import { CenterMessage } from "./bits";
import { EasyMenu } from "./EasyMenu";
import { NormalMenu } from "./NormalMenu";
import { CHOOSER, T } from "@/lib/i18n";
import type { Lang, MenuMode } from "@/lib/types";
import { useStored } from "@/lib/useStored";
import { useTable } from "@/lib/useTable";

/**
 * What opens when the table's QR code is scanned. One QR, two menus:
 * the phone asks once which menu its owner wants, then remembers.
 * `forced` (from ?menu=easy|normal) is used by the demo page and never saved.
 */
export function TableScreen({ table, forced }: { table: string; forced: MenuMode | null }) {
  const view = useTable(table);
  const [savedMode, saveMode, modeReady] = useStored<MenuMode | null>("ezorder:menu", null);
  const [lang, setLang, langReady] = useStored<Lang>("ezorder:lang", "en");
  const t = T[lang];

  if (view.status === "error") return <CenterMessage>{view.message}</CenterMessage>;
  if (view.status === "loading" || !modeReady || !langReady) return <CenterMessage>{t.loading}…</CenterMessage>;

  const mode = forced ?? savedMode;
  // Forced modes come from /demo, where there is nothing to go back to.
  const shared = {
    tableCode: table,
    table: view.table,
    menu: view.menu,
    myId: view.myId,
    lang,
    setLang,
    onBack: forced ? undefined : () => saveMode(null),
  };

  if (mode === "easy") return <EasyMenu key={view.table.session.id} {...shared} onSwitch={() => saveMode("normal")} />;
  if (mode === "normal") return <NormalMenu key={view.table.session.id} {...shared} onSwitch={() => saveMode("easy")} />;

  const photo = view.menu[0]?.image.startsWith("/") ? view.menu[0].image : "/menu/nasi-lemak.png";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-4">
      <AppBar tableLabel={t.table(table)} />
      <h1 className="flex flex-col gap-1 font-bold leading-tight">
        <span className="text-3xl">{CHOOSER.question[0]}</span>
        <span className="text-2xl text-soft">{CHOOSER.question[1]}</span>
        <span className="text-2xl text-soft" lang="zh">
          {CHOOSER.question[2]}
        </span>
      </h1>

      {/* Each choice shows a small picture of the menu it opens, so nobody has to read to choose. */}
      <button
        onClick={() => saveMode("easy")}
        className="flex flex-1 items-center gap-5 rounded-3xl border-4 border-primary bg-porcelain p-5 text-left active:bg-oats"
      >
        <span aria-hidden="true" className="flex w-32 shrink-0 flex-col gap-2 rounded-2xl bg-tabletop p-2">
          <span className="relative block h-28 overflow-hidden rounded-xl">
            <Image src={photo} alt="" fill sizes="128px" className="object-cover" />
          </span>
          <span className="flex h-7 items-center justify-center rounded-lg bg-primary text-lg font-bold text-ink">✓</span>
        </span>
        <span className="flex flex-col gap-1 font-bold">
          <span className="text-3xl leading-tight">{CHOOSER.easy[0]}</span>
          <span className="text-2xl text-soft">{CHOOSER.easy[1]}</span>
          <span className="text-2xl text-soft" lang="zh">
            {CHOOSER.easy[2]}
          </span>
        </span>
      </button>

      <button
        onClick={() => saveMode("normal")}
        className="flex items-center gap-5 rounded-3xl border-2 border-rule bg-porcelain p-5 text-left active:bg-oats"
      >
        <span aria-hidden="true" className="flex w-28 shrink-0 flex-col gap-1.5 rounded-2xl bg-tabletop p-2">
          {[0, 1, 2].map((i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span className="h-5 w-5 shrink-0 rounded bg-rule" />
              <span className="h-2 flex-1 rounded-full bg-rule" />
              <span className="h-2 w-4 rounded-full bg-soft" />
            </span>
          ))}
        </span>
        <span className="flex flex-col font-bold">
          <span className="text-2xl leading-tight">{CHOOSER.normal[0]}</span>
          <span className="text-lg text-soft">{CHOOSER.normal[1]}</span>
          <span className="text-lg text-soft" lang="zh">
            {CHOOSER.normal[2]}
          </span>
        </span>
      </button>
    </main>
  );
}
