"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { formatRM } from "@/lib/menu";
import { store } from "@/lib/store";
import type { MenuItem } from "@/lib/types";

type Lang = "en" | "ms" | "zh";
type ViewMode = "choose" | "big" | "normal";

const UI_TEXT: Record<
  Lang,
  {
    dishOf: (i: number, total: number) => string;
    iWantThis: string;
    added: string;
    back: string;
    nextDish: string;
    myPicks: string;
    sayOrder: string;
    listening: string;
    stopAndMatch: string;
    cancel: string;
    normalMenuTitle: string;
    switchBig: string;
    switchNormal: string;
    tableOrder: string;
    emptyPicks: string;
    close: string;
    soldOut: string;
  }
> = {
  en: {
    dishOf: (i, total) => `Dish ${i} of ${total}`,
    iWantThis: "✓ I want this",
    added: "✓ Added!",
    back: "Back",
    nextDish: "Next dish",
    myPicks: "My picks",
    sayOrder: "Say your order",
    listening: "Listening… speak in English, Malay, Mandarin or Rojak",
    stopAndMatch: "Done speaking",
    cancel: "Cancel",
    normalMenuTitle: "Full Menu & Group Cart",
    switchBig: "Big Photos",
    switchNormal: "Normal Menu",
    tableOrder: "Table Picks",
    emptyPicks: "No dishes picked yet.",
    close: "Back to menu",
    soldOut: "Sold out",
  },
  ms: {
    dishOf: (i, total) => `Hidangan ${i} daripada ${total}`,
    iWantThis: "✓ Saya mahu ini",
    added: "✓ Ditambah!",
    back: "Kembali",
    nextDish: "Seterusnya",
    myPicks: "Pilihan saya",
    sayOrder: "Sebut pesanan",
    listening: "Mendengar… sila sebut pesanan anda",
    stopAndMatch: "Siap bercakap",
    cancel: "Batal",
    normalMenuTitle: "Menu Biasa & Bakul Meja",
    switchBig: "Gambar Besar",
    switchNormal: "Menu Biasa",
    tableOrder: "Pilihan Meja",
    emptyPicks: "Belum ada pilihan.",
    close: "Kembali ke menu",
    soldOut: "Habis dijual",
  },
  zh: {
    dishOf: (i, total) => `第 ${i} / ${total} 道菜`,
    iWantThis: "✓ 我要这个",
    added: "✓ 已加入！",
    back: "上一道",
    nextDish: "下一道",
    myPicks: "我点的菜",
    sayOrder: "语音点餐",
    listening: "请说话… 支持华语、马来语、英语",
    stopAndMatch: "说完了",
    cancel: "取消",
    normalMenuTitle: "普通菜单与同桌点餐车",
    switchBig: "大图菜单",
    switchNormal: "普通菜单",
    tableOrder: "本桌已选",
    emptyPicks: "还没有点菜。",
    close: "返回菜单",
    soldOut: "已售罄",
  },
};

export default function TableOrderPage({
  initialMode,
  tableOverride,
  embedded = false,
}: {
  initialMode?: ViewMode;
  tableOverride?: string;
  embedded?: boolean;
} = {}) {
  const params = useParams<{ table?: string }>();
  const table = tableOverride ?? params?.table ?? "5";

  const [mode, setMode] = useState<ViewMode>(initialMode ?? "choose");
  const [lang, setLang] = useState<Lang>("en");
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [justAdded, setJustAdded] = useState(false);

  // Cart quantities keyed by dish ID
  const [cart, setCart] = useState<Record<string, number>>({});
  const [showPicks, setShowPicks] = useState(false);

  // Voice recording modal state
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  // Subscribe to live menu updates
  useEffect(() => {
    const unsub = store.subscribeMenu((items) => {
      setMenu(items);
    }, setProblem);
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []);

  // Subscribe to shared table cart if store supports it, with localStorage fallback
  useEffect(() => {
    const anyStore = store as Record<string, any>;
    if (typeof anyStore.subscribeTable === "function") {
      const unsub = anyStore.subscribeTable(
        table,
        (tableState: any) => {
          if (tableState && typeof tableState === "object") {
            const nextCart: Record<string, number> = {};
            if (Array.isArray(tableState.items)) {
              for (const line of tableState.items) {
                nextCart[line.id ?? line.itemId] = line.qty ?? line.quantity ?? 1;
              }
            } else if (tableState.quantities) {
              Object.assign(nextCart, tableState.quantities);
            }
            setCart(nextCart);
          }
        },
        setProblem
      );
      return () => {
        if (typeof unsub === "function") unsub();
      };
    }

    const saved = localStorage.getItem(`ezorder_cart_${table}`);
    if (saved) {
      try {
        setCart(JSON.parse(saved));
      } catch {
        // ignore invalid JSON
      }
    }
  }, [table]);

  function updateQty(itemId: string, delta: number) {
    setCart((prev) => {
      const nextQty = Math.max(0, (prev[itemId] ?? 0) + delta);
      const next = { ...prev };
      if (nextQty === 0) {
        delete next[itemId];
      } else {
        next[itemId] = nextQty;
      }
      localStorage.setItem(`ezorder_cart_${table}`, JSON.stringify(next));
      return next;
    });

    const anyStore = store as Record<string, any>;
    if (typeof anyStore.addItem === "function" && delta > 0) {
      void anyStore.addItem(table, itemId, delta);
    } else if (typeof anyStore.setQty === "function") {
      const current = (cart[itemId] ?? 0) + delta;
      void anyStore.setQty(table, itemId, Math.max(0, current));
    }
  }

  const availableDishes = menu.filter((item) => item.inStock !== false);
  const safeIndex =
    availableDishes.length > 0 ? Math.min(index, availableDishes.length - 1) : 0;
  const currentDish = availableDishes[safeIndex] ?? null;

  const totalPicks = Object.values(cart).reduce((sum, n) => sum + n, 0);
  const totalPrice = menu.reduce(
    (sum, item) => sum + (cart[item.id] ?? 0) * item.price,
    0
  );

  const t = UI_TEXT[lang];

  function handlePickCurrent() {
    if (!currentDish) return;
    updateQty(currentDish.id, 1);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 900);
  }

  async function startVoiceRecording() {
    setVoiceMessage(null);
    setVoiceOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        await sendAudioToIlmu(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setRecording(false);
      setVoiceMessage(
        "Microphone permission is off. Tap a dish photo below to add it directly."
      );
    }
  }

  function stopVoiceRecording() {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  }

  async function sendAudioToIlmu(blob: Blob) {
    setVoiceMessage("Matching your order…");
    try {
      const form = new FormData();
      const ext = blob.type.includes("mp4") ? "order.m4a" : "order.webm";
      form.append("audio", blob, ext);
      form.append("table", table);

      const res = await fetch("/api/voice", {
        method: "POST",
        body: form,
      });

      if (!res.ok) throw new Error("Voice endpoint busy");
      const data = await res.json();

      if (data?.items && Array.isArray(data.items) && data.items.length > 0) {
        for (const matched of data.items) {
          updateQty(matched.id ?? matched.dishId, matched.qty ?? 1);
        }
        setVoiceMessage("Added to your picks!");
        setTimeout(() => setVoiceOpen(false), 1000);
      } else {
        setVoiceMessage(
          data?.message ?? "Could not catch the dish name. Please tap a photo below:"
        );
      }
    } catch {
      setVoiceMessage("Voice AI is busy right now. Tap a dish below to add it:");
    }
  }

  function getDishName(item: MenuItem): string {
    const n = item.name as Record<string, string>;
    return n?.[lang] || n?.en || "Dish";
  }

  function getDishDesc(item: MenuItem): string {
    const d = (item as Record<string, any>).description as
      | Record<string, string>
      | string
      | undefined;
    if (!d) return "";
    if (typeof d === "string") return d;
    return d[lang] || d.en || "";
  }

  function getDishImage(item: MenuItem): string {
    const anyItem = item as Record<string, any>;
    return anyItem.image || anyItem.photo || `/menu/${item.id}.jpg`;
  }

  const shellClass = embedded
    ? "flex h-full w-full flex-col bg-[#f5f3ef] text-neutral-900 overflow-hidden"
    : "mx-auto flex h-dvh max-h-dvh w-full max-w-md flex-col bg-[#f5f3ef] text-neutral-900 overflow-hidden pb-[max(0.5rem,env(safe-area-inset-bottom))]";

  // Shared "My Picks" drawer so it works in both Normal and Big Photos views
  const picksDrawer = showPicks ? (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center p-2">
      <div className="bg-white w-full max-w-md rounded-3xl p-4 flex flex-col gap-3 max-h-[85dvh]">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold">{t.myPicks}</h2>
          <span className="text-lg font-extrabold">{formatRM(totalPrice)}</span>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col gap-2">
          {totalPicks === 0 ? (
            <p className="text-neutral-500 py-6 text-center font-semibold">
              {t.emptyPicks}
            </p>
          ) : (
            menu
              .filter((item) => (cart[item.id] ?? 0) > 0)
              .map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 bg-neutral-100 rounded-2xl p-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-base truncate">
                      {getDishName(item)}
                    </p>
                    <p className="text-xs font-bold text-neutral-600">
                      {formatRM(item.price)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => updateQty(item.id, -1)}
                      className="w-10 h-10 rounded-xl bg-white border-2 border-neutral-900 font-extrabold text-lg"
                    >
                      −
                    </button>
                    <span className="w-6 text-center font-extrabold text-base">
                      {cart[item.id]}
                    </span>
                    <button
                      onClick={() => updateQty(item.id, 1)}
                      className="w-10 h-10 rounded-xl bg-[#f47521] text-black font-extrabold text-lg"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))
          )}
        </div>

        <button
          onClick={() => setShowPicks(false)}
          className="w-full bg-neutral-900 text-white font-extrabold text-lg py-3 rounded-2xl"
        >
          ⬅️ {t.close}
        </button>
      </div>
    </div>
  ) : null;

  // ---------------------------------------------------------------------------
  // SCREEN 1: MODE SELECTION ("How do you want to order?")
  // ---------------------------------------------------------------------------
  if (mode === "choose") {
    const heroImage = availableDishes[0]
      ? getDishImage(availableDishes[0])
      : "/menu/nasi-lemak.jpg";

    return (
      <div className={shellClass}>
        <header className="bg-[#f47521] px-4 py-3 shrink-0">
          <p className="font-extrabold text-black text-base sm:text-lg leading-tight truncate">
            Kopitiam Sedap
          </p>
          <p className="text-black/90 font-semibold text-xs sm:text-sm">
            Table {table}
          </p>
        </header>

        <main className="flex-1 flex flex-col justify-between p-4 gap-3 overflow-y-auto">
          <div className="shrink-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 leading-tight">
              How do you want to order?
            </h1>
            <p className="text-base sm:text-lg font-bold text-neutral-600 mt-1">
              Bagaimana anda mahu pesan?
            </p>
            <p className="text-base sm:text-lg font-bold text-neutral-600">
              您想怎样点餐？
            </p>
          </div>

          <div className="flex-1 flex flex-col justify-center gap-3 min-h-0">
            <button
              onClick={() => setMode("big")}
              className="w-full text-left bg-white border-[3px] border-[#f47521] rounded-3xl p-3.5 sm:p-4 flex items-center gap-3.5 shadow-sm active:scale-[0.99] transition"
            >
              <div className="w-24 sm:w-28 shrink-0 bg-neutral-100 rounded-2xl p-2 flex flex-col items-center gap-1.5">
                <img
                  src={heroImage}
                  alt="Big Photos Menu"
                  className="w-full aspect-square object-cover rounded-full"
                />
                <span className="w-full bg-[#f47521] text-black font-extrabold text-center py-1 rounded-lg text-xs sm:text-sm">
                  ✓
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl sm:text-2xl font-extrabold text-neutral-900 leading-tight">
                  Big Photos Menu
                </h2>
                <p className="text-base sm:text-lg font-bold text-neutral-600 leading-snug mt-1">
                  Menu Gambar Besar
                </p>
                <p className="text-base sm:text-lg font-bold text-neutral-600 mt-0.5">
                  大图菜单
                </p>
              </div>
            </button>

            <button
              onClick={() => setMode("normal")}
              className="w-full text-left bg-white border-2 border-neutral-300 rounded-3xl p-3.5 sm:p-4 flex items-center gap-3.5 shadow-sm active:scale-[0.99] transition"
            >
              <div className="w-24 sm:w-28 shrink-0 bg-neutral-100 rounded-2xl p-3 flex flex-col gap-2 justify-center aspect-square">
                <div className="h-2.5 bg-neutral-400 rounded-full" />
                <div className="h-2.5 bg-neutral-400 rounded-full" />
                <div className="h-2.5 bg-neutral-400 rounded-full" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg sm:text-xl font-extrabold text-neutral-900 leading-tight">
                  Normal Menu
                </h2>
                <p className="text-sm sm:text-base font-bold text-neutral-600 mt-1">
                  Menu Biasa
                </p>
                <p className="text-sm sm:text-base font-bold text-neutral-600">
                  普通菜单
                </p>
              </div>
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // SCREEN 2: NORMAL MENU (Younger Family Member / Group Cart View)
  // ---------------------------------------------------------------------------
  if (mode === "normal") {
    return (
      <div className={shellClass}>
        <header className="bg-[#f47521] px-3 py-2.5 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {!initialMode && (
              <button
                onClick={() => setMode("choose")}
                aria-label="Back"
                className="w-9 h-9 shrink-0 rounded-xl border-2 border-black/80 flex items-center justify-center font-extrabold text-black"
              >
                &lt;
              </button>
            )}
            <div className="min-w-0 leading-tight">
              <p className="font-extrabold text-black text-sm truncate">
                Kopitiam Sedap
              </p>
              <p className="text-xs font-bold text-black/90">Table {table}</p>
            </div>
          </div>

          <button
            onClick={() => setMode("big")}
            className="bg-white text-black font-bold text-xs px-3 py-1.5 rounded-xl shrink-0"
          >
            {t.switchBig}
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
          {menu.map((item) => {
            const qty = cart[item.id] ?? 0;
            const soldOut = item.inStock === false;
            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl p-3 flex items-center gap-3 shadow-sm ${
                  soldOut ? "opacity-60" : ""
                }`}
              >
                <img
                  src={getDishImage(item)}
                  alt={getDishName(item)}
                  className="w-16 h-16 rounded-xl object-cover shrink-0 bg-neutral-100"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold text-base text-neutral-900 truncate">
                    {getDishName(item)}
                  </p>
                  <p className="text-xs text-neutral-600 line-clamp-1">
                    {getDishDesc(item)}
                  </p>
                  <p className="text-sm font-extrabold text-neutral-900 mt-0.5">
                    {formatRM(item.price)}
                  </p>
                </div>

                {soldOut ? (
                  <span className="text-xs font-bold bg-neutral-200 text-neutral-700 px-2.5 py-1.5 rounded-lg shrink-0">
                    {t.soldOut}
                  </span>
                ) : (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {qty > 0 && (
                      <>
                        <button
                          onClick={() => updateQty(item.id, -1)}
                          className="w-8 h-8 rounded-lg border-2 border-neutral-900 font-extrabold text-base flex items-center justify-center"
                        >
                          −
                        </button>
                        <span className="w-5 text-center font-extrabold text-sm">
                          {qty}
                        </span>
                      </>
                    )}
                    <button
                      onClick={() => updateQty(item.id, 1)}
                      className="h-8 px-2.5 rounded-lg bg-[#f47521] text-black font-extrabold text-sm flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </main>

        <footer className="bg-white border-t border-neutral-200 p-3 flex items-center justify-between shrink-0">
          <div>
            <p className="text-xs font-bold text-neutral-500">
              {t.tableOrder} ({totalPicks})
            </p>
            <p className="text-lg font-extrabold text-neutral-900">
              {formatRM(totalPrice)}
            </p>
          </div>
          <button
            onClick={() => setShowPicks(true)}
            className="bg-neutral-900 text-white font-extrabold text-sm px-4 py-2.5 rounded-xl"
          >
            {t.myPicks} ({totalPicks})
          </button>
        </footer>

        {picksDrawer}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // SCREEN 3: BIG PHOTOS MENU (Grandpa / Elderly View - Responsive & Unclipped)
  // ---------------------------------------------------------------------------
  return (
    <div className={shellClass}>
      {/* Merged Compact Header with EN / BM / 中文 Switcher */}
      <header className="bg-[#f47521] px-3 py-2 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {!initialMode && (
            <button
              onClick={() => setMode("choose")}
              aria-label="Back"
              className="w-8 h-8 shrink-0 rounded-lg border-2 border-black/80 flex items-center justify-center text-sm font-extrabold text-black"
            >
              &lt;
            </button>
          )}
          <div className="min-w-0 flex-1 leading-tight">
            <p className="font-extrabold text-black text-xs sm:text-sm truncate">
              Kopitiam Sedap
            </p>
            <p className="text-[11px] font-bold text-black/90 truncate">
              Table {table}
            </p>
          </div>
        </div>

        {/* Compact Language Switcher */}
        <div className="bg-white rounded-xl p-0.5 flex items-center shrink-0 text-[11px] font-bold">
          <button
            onClick={() => setLang("en")}
            className={`px-2 py-1 rounded-lg transition ${
              lang === "en" ? "bg-neutral-900 text-white" : "text-neutral-900"
            }`}
          >
            EN
          </button>
          <button
            onClick={() => setLang("ms")}
            className={`px-1.5 py-1 rounded-lg transition ${
              lang === "ms" ? "bg-neutral-900 text-white" : "text-neutral-900"
            }`}
          >
            BM
          </button>
          <button
            onClick={() => setLang("zh")}
            className={`px-1.5 py-1 rounded-lg transition ${
              lang === "zh" ? "bg-neutral-900 text-white" : "text-neutral-900"
            }`}
          >
            中文
          </button>
        </div>
      </header>

      {problem && (
        <p className="bg-red-100 text-red-900 text-xs font-bold px-3 py-1 shrink-0">
          {problem}
        </p>
      )}

      {/* Elastic Main Body - fits every screen height without clipping RM 8.90 */}
      <main className="flex-1 min-h-0 flex flex-col justify-between p-2.5 sm:p-3 gap-2">
        {currentDish ? (
          <div className="bg-white rounded-2xl p-2.5 sm:p-3.5 shadow-sm flex-1 min-h-0 flex flex-col justify-between overflow-hidden">
            {/* Elastic Dish Image */}
            <div className="w-full flex-1 min-h-[90px] rounded-xl overflow-hidden bg-neutral-100">
              <img
                src={getDishImage(currentDish)}
                alt={getDishName(currentDish)}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Locked Text & Price Block */}
            <div className="shrink-0 pt-2">
              <p className="text-xs font-semibold text-neutral-500">
                {t.dishOf(safeIndex + 1, availableDishes.length)}
              </p>

              <div className="flex items-baseline justify-between gap-2 mt-0.5">
                <h1 className="text-xl sm:text-2xl font-extrabold text-neutral-900 truncate">
                  {getDishName(currentDish)}
                </h1>
                <span className="text-lg sm:text-xl font-extrabold text-neutral-900 shrink-0">
                  {formatRM(currentDish.price)}
                </span>
              </div>

              <p className="text-xs sm:text-sm text-neutral-600 mt-0.5 line-clamp-2 leading-snug">
                {getDishDesc(currentDish)}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-6 flex-1 flex items-center justify-center text-center font-bold text-neutral-500">
            Loading menu…
          </div>
        )}

        {/* Bottom Controls */}
        <div className="shrink-0 flex flex-col gap-1.5 sm:gap-2">
          <button
            onClick={handlePickCurrent}
            disabled={!currentDish}
            className="w-full bg-[#f47521] active:bg-[#d96416] text-black font-extrabold text-lg sm:text-xl py-2.5 sm:py-3 rounded-2xl shadow-sm transition disabled:opacity-40"
          >
            {justAdded ? t.added : t.iWantThis}
          </button>

          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            <button
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={safeIndex === 0}
              className="col-span-1 bg-neutral-200 text-neutral-800 disabled:text-neutral-400 font-bold text-sm sm:text-base py-2.5 rounded-2xl transition"
            >
              {t.back}
            </button>
            <button
              onClick={() =>
                setIndex((i) =>
                  availableDishes.length > 0
                    ? (i + 1) % availableDishes.length
                    : 0
                )
              }
              className="col-span-2 bg-white border-2 border-neutral-900 text-neutral-900 font-extrabold text-base sm:text-lg py-2.5 rounded-2xl active:bg-neutral-100 transition"
            >
              {t.nextDish}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
            <button
              onClick={() => setShowPicks(true)}
              className="bg-neutral-900 text-white font-bold text-sm sm:text-base py-2.5 px-2.5 rounded-2xl flex items-center justify-center gap-1.5"
            >
              <span className="truncate">{t.myPicks}</span>
              <span className="bg-white text-black rounded-full px-2 py-0.5 text-xs font-extrabold shrink-0">
                {totalPicks}
              </span>
            </button>

            <button
              onClick={() => void startVoiceRecording()}
              className="bg-white border-2 border-neutral-900 text-neutral-900 font-bold text-xs sm:text-sm py-2 px-2.5 rounded-2xl flex items-center justify-center gap-1.5 leading-tight"
            >
              <span aria-hidden="true" className="text-base shrink-0">
                🎙️
              </span>
              <span className="line-clamp-2 text-left">{t.sayOrder}</span>
            </button>
          </div>
        </div>
      </main>

      {picksDrawer}

      {/* VOICE ORDERING MODAL (With instant photo fallback so user is never stuck) */}
      {voiceOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center p-2">
          <div className="bg-white w-full max-w-md rounded-3xl p-4 flex flex-col gap-3 max-h-[85dvh]">
            <h2 className="text-xl font-extrabold">🎙️ {t.sayOrder}</h2>
            <p className="text-sm font-bold text-neutral-700">
              {recording ? t.listening : voiceMessage}
            </p>

            {recording ? (
              <button
                onClick={stopVoiceRecording}
                className="w-full bg-[#f47521] text-black font-extrabold text-lg py-3.5 rounded-2xl"
              >
                ✓ {t.stopAndMatch}
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2 overflow-y-auto max-h-56">
                {availableDishes.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      updateQty(item.id, 1);
                      setVoiceOpen(false);
                    }}
                    className="flex flex-col items-start bg-neutral-100 rounded-2xl p-2 text-left"
                  >
                    <img
                      src={getDishImage(item)}
                      alt={getDishName(item)}
                      className="w-full h-20 object-cover rounded-xl"
                    />
                    <span className="font-extrabold text-sm mt-1 truncate w-full">
                      {getDishName(item)}
                    </span>
                    <span className="text-xs font-bold text-neutral-600">
                      {formatRM(item.price)}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => {
                stopVoiceRecording();
                setVoiceOpen(false);
              }}
              className="w-full bg-neutral-200 text-neutral-900 font-extrabold text-base py-3 rounded-2xl"
            >
              {t.cancel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
