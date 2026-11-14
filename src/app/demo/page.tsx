/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { formatRM } from "@/lib/menu";
import { store } from "@/lib/store";
import type { MenuItem } from "@/lib/types";

type Lang = "en" | "ms" | "zh";
type ViewMode = "choose" | "big" | "normal";
type OrderType = "dine_in" | "takeaway";

interface MatchedOrderLine {
  item: MenuItem;
  qty: number;
  note?: string;
}

interface PendingConfirmation {
  lines: MatchedOrderLine[];
  orderType: OrderType;
  isSoldOutAlternative?: boolean;
  soldOutItemName?: string;
  spokenPrompt: string;
  userTranscript?: string;
}

const UI_TEXT: Record<
  Lang,
  {
    switchMenu: string;
    tableLabel: (t: string) => string;
    dineIn: string;
    takeaway: string;
    dishOf: (i: number, total: number) => string;
    hearDish: string;
    iWantThis: (num: number) => string;
    back: string;
    nextDish: string;
    myPicks: string;
    giantVoiceBtn: string;
    giantVoiceSub: string;
    confirmTitle: string;
    yesConfirm: string;
    noCancel: string;
    speakAgain: string;
    voiceConfirmHint: string;
    listening: string;
    voiceHint: string;
    typeOrSpeakPlaceholder: string;
    askAiBtn: string;
    stopAndMatch: string;
    cancel: string;
    switchBig: string;
    tableOrder: string;
    emptyPicks: string;
    close: string;
    soldOut: string;
    orderSentBanner: string;
    sendOrderNow: string;
  }
> = {
  en: {
    switchMenu: "Menu",
    tableLabel: (t) => `Table ${t}`,
    dineIn: "🍽️ Eat Here",
    takeaway: "🛍️ Takeaway (Tapau)",
    dishOf: (i, total) => `Dish #${i} of ${total}`,
    hearDish: "🔊 Hear dish",
    iWantThis: (num) => `✓ Add #${num}`,
    back: "⬅️ Prev",
    nextDish: "Next ➔",
    myPicks: "My picks",
    giantVoiceBtn: "🎙️ PRESS TO SPEAK ORDER",
    giantVoiceSub: "AI understands English, Malay, Mandarin, Cantonese & Rojak",
    confirmTitle: "🤖 AI Order Confirmation (Yes / No)",
    yesConfirm: "✓ YES, CONFIRM ORDER",
    noCancel: "✕ NO, CHANGE / CANCEL",
    speakAgain: "🔊 Read back again",
    voiceConfirmHint: "Tap YES or NO — or simply say 'Yes' or 'No' out loud!",
    listening: "Listening… speak naturally (e.g. 'Two #1 tapau, less spicy')",
    voiceHint: "Say dish numbers, names, 'what is nice?', 'not spicy', or 'tapau'",
    typeOrSpeakPlaceholder: "Or type any natural request to test AI…",
    askAiBtn: "Ask AI",
    stopAndMatch: "✓ Done Speaking — Let AI Match",
    cancel: "Back to menu",
    switchBig: "Big Photos",
    tableOrder: "Order Summary",
    emptyPicks: "No dishes picked yet.",
    close: "Back to menu",
    soldOut: "Sold out",
    orderSentBanner: "✓ Confirmed & added to your order!",
    sendOrderNow: "✓ Confirm All & Send to Kitchen",
  },
  ms: {
    switchMenu: "Menu",
    tableLabel: (t) => `Meja ${t}`,
    dineIn: "🍽️ Makan Sini",
    takeaway: "🛍️ Bungkus (Tapau)",
    dishOf: (i, total) => `Hidangan #${i} / ${total}`,
    hearDish: "🔊 Dengar",
    iWantThis: (num) => `✓ Pilih #${num}`,
    back: "⬅️ Sebelum",
    nextDish: "Seterusnya ➔",
    myPicks: "Pilihan",
    giantVoiceBtn: "🎙️ TEKAN & SEBUT PESANAN",
    giantVoiceSub: "AI faham Melayu, Inggeris, Cina, Kantonis & Bahasa Rojak",
    confirmTitle: "🤖 Sahkan Pesanan AI (Ya / Tidak)",
    yesConfirm: "✓ YA, SAYA MAHU INI",
    noCancel: "✕ TIDAK, TUKAR LAIN",
    speakAgain: "🔊 Dengar semula",
    voiceConfirmHint: "Tekan YA atau TIDAK — atau sebut 'Ya' / 'Tidak'!",
    listening: "Mendengar… cakap macam biasa (cth: 'Dua #1 bungkus kurang pedas')",
    voiceHint: "Boleh sebut nombor, nama makanan, 'tak pedas', atau 'tapau'",
    typeOrSpeakPlaceholder: "Atau taip pesanan anda di sini…",
    askAiBtn: "Hantar ke AI",
    stopAndMatch: "✓ Siap Bercakap — Padankan",
    cancel: "Kembali",
    switchBig: "Gambar Besar",
    tableOrder: "Ringkasan Meja",
    emptyPicks: "Belum ada pilihan.",
    close: "Kembali ke menu",
    soldOut: "Habis",
    orderSentBanner: "✓ Disahkan & ditambah ke pesanan!",
    sendOrderNow: "✓ Sahkan Semua & Hantar ke Dapur",
  },
  zh: {
    switchMenu: "换菜单",
    tableLabel: (t) => `${t}号桌`,
    dineIn: "🍽️ 堂食",
    takeaway: "🛍️ 打包 (Tapau)",
    dishOf: (i, total) => `第 #${i} 道，共 ${total} 道`,
    hearDish: "🔊 听语音报菜",
    iWantThis: (num) => `✓ 我要 #${num} 号`,
    back: "⬅️ 上一道",
    nextDish: "下一道 ➔",
    myPicks: "我点的",
    giantVoiceBtn: "🎙️ 按这里大声说出您要点的菜",
    giantVoiceSub: "AI 智能听懂：华语 · 广东话 · 福建话 · 马来语 · 英语",
    confirmTitle: "🤖 AI 语音点餐确认 (是 / 不要)",
    yesConfirm: "✓ 是，确定要这个 (YES)",
    noCancel: "✕ 不要，重选 / 取消 (NO)",
    speakAgain: "🔊 再听一次语音",
    voiceConfirmHint: "请按绿色「是」或「不要」，也可以直接对着麦克风说“要”或“不要”！",
    listening: "正在聆听… 请随便说（例如：“两份 1号 椰浆饭 少辣 打包”）",
    voiceHint: "支持说号码、菜名、“有什么好吃？”、“不要辣”、“少甜”、“打包/堂食”",
    typeOrSpeakPlaceholder: "或者直接在这里输入一句话测试 AI…",
    askAiBtn: "AI 识别",
    stopAndMatch: "✓ 说完了，让 AI 帮我点餐",
    cancel: "返回菜单",
    switchBig: "大图菜单",
    tableOrder: "本桌已选餐点",
    emptyPicks: "还没有点菜。",
    close: "返回菜单",
    soldOut: "已售罄",
    orderSentBanner: "✓ 已确认加入您的点餐单！",
    sendOrderNow: "✓ 确认全部并送往厨房",
  },
};

const NUMBER_WORDS: Record<number, string[]> = {
  1: ["1", "one", "first", "satu", "pertama", "一", "一号", "1号", "第一", "yat", "jat", "cit"],
  2: ["2", "two", "second", "dua", "kedua", "二", "两", "二号", "两号", "2号", "第二", "yi", "ji", "nng"],
  3: ["3", "three", "third", "tiga", "ketiga", "三", "三号", "3号", "第三", "sam", "saam", "sa"],
  4: ["4", "four", "fourth", "empat", "keempat", "四", "四号", "4号", "第四", "sei", "si"],
  5: ["5", "five", "fifth", "lima", "kelima", "五", "五号", "5号", "第五", "ng", "go"],
  6: ["6", "six", "sixth", "enam", "keenam", "六", "六号", "6号", "第六", "luk", "lak"],
};

const TAKEAWAY_WORDS = [
  "tapau",
  "ta pau",
  "dabao",
  "da bao",
  "bungkus",
  "takeaway",
  "take away",
  "to go",
  "打包",
  "外带",
  "拎走",
  "包走",
];

const DINE_IN_WORDS = [
  "eat here",
  "dine in",
  "having here",
  "makan sini",
  "堂食",
  "这里吃",
  "喺度食",
  "内用",
];

const YES_WORDS = [
  "yes",
  "yeah",
  "yep",
  "ok",
  "okay",
  "confirm",
  "correct",
  "ya",
  "betul",
  "boleh",
  "nak",
  "mahu",
  "要",
  "是",
  "好",
  "可以",
  "对",
  "确定",
  "係",
  "好啊",
];

const NO_WORDS = [
  "no",
  "nope",
  "cancel",
  "wrong",
  "change",
  "tidak",
  "tak",
  "tak nak",
  "bukan",
  "batal",
  "不要",
  "不是",
  "不对",
  "取消",
  "唔要",
  "唔係",
  "换",
];

const DIALECT_KEYWORDS: Record<string, string[]> = {
  "nasi-lemak": ["nasi lemak", "nasilemak", "lemak", "椰浆饭", "辣死你妈", "lah si", "ayam goreng", "rice", "饭"],
  "char-kuey-teow": ["char kuey teow", "char kway teow", "ckt", "chao guo tiao", "炒粿条", "炒贵刁", "kuey teow", "guetiau", "noodle", "面", "粉"],
  "hainanese-chicken-rice": ["chicken rice", "nasi ayam", "kai fan", "gai fan", "鸡饭", "海南鸡饭", "白斩鸡", "not spicy", "不辣", "tak pedas"],
  "laksa": ["laksa", "curry laksa", "asam laksa", "叻沙", "咖喱面", "curry mee", "spicy", "辣"],
  "roti-canai": ["roti", "roti canai", "roti kosong", "印度煎饼", "canai"],
  "teh-tarik": ["teh tarik", "teh", "teh peng", "teh c", "拉茶", "奶茶", "drink", "water", "水", "茶"],
  "kopi": ["kopi", "kopi o", "kopi peng", "kopi c", "coffee", "咖啡", "ga fei", "cham"],
};

export default function TableOrderPage() {
  const params = useParams<{ code?: string; table?: string }>();
  const table = params?.code ?? params?.table ?? "1";

  const [mode, setMode] = useState<ViewMode>("big");
  const [lang, setLang] = useState<Lang>("zh");
  const [orderType, setOrderType] = useState<OrderType>("dine_in");
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [banner, setBanner] = useState<string | null>(null);

  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartNotes, setCartNotes] = useState<Record<string, string>>({});
  const [showPicks, setShowPicks] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirmation | null>(null);

  const [voiceOpen, setVoiceOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [voiceMessage, setVoiceMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const speechRecRef = useRef<{ stop: () => void } | null>(null);
  const confirmSpeechRecRef = useRef<{ stop: () => void } | null>(null);
  const transcriptRef = useRef<string>("");
  const chunksRef = useRef<BlobPart[]>([]);

  const t = UI_TEXT[lang];

  const speakOutLoud = useCallback(
    (text: string, overrideLang?: Lang) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        const targetLang = overrideLang ?? lang;
        utter.lang =
          targetLang === "zh" ? "zh-CN" : targetLang === "ms" ? "ms-MY" : "en-MY";
        utter.rate = 0.93;
        utter.pitch = 1.0;
        window.speechSynthesis.speak(utter);
      } catch {
        // Ignore TTS autoplay block
      }
    },
    [lang]
  );

  useEffect(() => {
    const unsub = store.subscribeMenu((items) => {
      setMenu(items);
    }, setProblem);
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(`ezorder_cart_${table}`);
    if (saved) {
      try {
        setCart(JSON.parse(saved) as Record<string, number>);
      } catch {
        // ignore
      }
    }
    const savedType = localStorage.getItem(`ezorder_type_${table}`);
    if (savedType === "dine_in" || savedType === "takeaway") {
      setOrderType(savedType);
    }
  }, [table]);

  function changeOrderType(nextType: OrderType) {
    setOrderType(nextType);
    localStorage.setItem(`ezorder_type_${table}`, nextType);
    const spoken =
      lang === "zh"
        ? nextType === "takeaway"
          ? "已为您切换为打包带走"
          : "已为您切换为堂食"
        : lang === "ms"
        ? nextType === "takeaway"
          ? "Ditukar kepada Bungkus Tapau"
          : "Ditukar kepada Makan Sini"
        : nextType === "takeaway"
        ? "Switched to Takeaway Tapau"
        : "Switched to Eat Here";
    speakOutLoud(spoken);
  }

  function updateQty(itemId: string, delta: number, note?: string) {
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

    if (note) {
      setCartNotes((prev) => ({ ...prev, [itemId]: note }));
    }

    const storeObj = store as unknown as Record<string, unknown>;
    if (typeof storeObj.addItem === "function" && delta > 0) {
      void (storeObj.addItem as (t: string, id: string, q: number) => Promise<void>)(
        table,
        itemId,
        delta
      );
    } else if (typeof storeObj.add === "function" && delta > 0) {
      void (storeObj.add as (t: string, id: string) => Promise<void>)(table, itemId);
    }
  }

  const availableDishes = menu.filter((item) => item.inStock !== false);
  const soldOutDishes = menu.filter((item) => item.inStock === false);
  const safeIndex =
    availableDishes.length > 0 ? Math.min(index, availableDishes.length - 1) : 0;
  const currentDish = availableDishes[safeIndex] ?? null;

  const totalPicks = Object.values(cart).reduce((sum, n) => sum + n, 0);
  const totalPrice = menu.reduce(
    (sum, item) => sum + (cart[item.id] ?? 0) * item.price,
    0
  );

  function getDishNumber(item: MenuItem): number {
    const idx = availableDishes.findIndex((d) => d.id === item.id);
    if (idx !== -1) return idx + 1;
    return menu.findIndex((d) => d.id === item.id) + 1;
  }

  function getDishName(item: MenuItem): string {
    const n = item.name as Record<string, string>;
    return n?.[lang] || n?.en || "Dish";
  }

  function getDishDesc(item: MenuItem): string {
    const raw = item as unknown as Record<string, unknown>;
    for (const key of ["description", "desc", "blurb", "summary", "ingredients"]) {
      const val = raw[key];
      if (typeof val === "string" && val.length > 0) return val;
      if (val && typeof val === "object") {
        const dict = val as Record<string, string>;
        if (dict[lang] || dict.en) return dict[lang] || dict.en || "";
      }
    }
    return "";
  }

  function getDishImage(item: MenuItem): string {
    const raw = item as unknown as Record<string, unknown>;
    for (const key of ["photo", "image", "img", "photoUrl", "imageUrl", "src"]) {
      if (typeof raw[key] === "string" && (raw[key] as string).length > 0) {
        return raw[key] as string;
      }
    }
    for (const val of Object.values(raw)) {
      if (
        typeof val === "string" &&
        (val.startsWith("/") || val.startsWith("http") || val.startsWith("data:image"))
      ) {
        return val;
      }
    }
    return `/menu/${item.id}.jpg`;
  }

  // Extract custom taste notes (e.g., kurang manis, less spicy, no peanuts, kosong, peng)
  function extractCustomNote(spoken: string): string | undefined {
    const notes: string[] = [];
    const s = spoken.toLowerCase();
    if (s.includes("kurang manis") || s.includes("less sweet") || s.includes("少甜")) {
      notes.push(lang === "zh" ? "少甜" : "Kurang manis");
    }
    if (s.includes("kosong") || s.includes("no sugar") || s.includes("走甜")) {
      notes.push(lang === "zh" ? "走甜 (Kosong)" : "Kosong");
    }
    if (s.includes("kurang pedas") || s.includes("less spicy") || s.includes("少辣") || s.includes("微辣")) {
      notes.push(lang === "zh" ? "少辣" : "Kurang pedas");
    }
    if (s.includes("tak pedas") || s.includes("no spicy") || s.includes("不要辣") || s.includes("走辣")) {
      notes.push(lang === "zh" ? "不要辣" : "Tak pedas");
    }
    if (s.includes("no peanut") || s.includes("tak nak kacang") || s.includes("不要花生") || s.includes("走花生")) {
      notes.push(lang === "zh" ? "不要花生" : "No peanuts");
    }
    if (s.includes("extra sambal") || s.includes("tambah sambal") || s.includes("加参巴") || s.includes("加辣")) {
      notes.push(lang === "zh" ? "加参巴辣酱" : "Extra sambal");
    }
    if (s.includes("peng") || s.includes("ais") || s.includes("iced") || s.includes("冰") || s.includes("冷")) {
      notes.push(lang === "zh" ? "加冰 (Peng)" : "Iced (Peng)");
    }
    return notes.length > 0 ? notes.join(", ") : undefined;
  }

  function extractSpokenQuantity(spoken: string): number {
    const s = spoken.toLowerCase();
    if (/\b(three|tiga|三份|三个|三碗|三杯|3份)\b/.test(s)) return 3;
    if (/\b(two|dua|两份|两个|两碗|两杯|二份|2份)\b/.test(s)) return 2;
    return 1;
  }

  function buildReadbackPrompt(
    lines: MatchedOrderLine[],
    type: OrderType,
    soldOutItem?: MenuItem,
    customAiMessage?: string
  ): string {
    if (customAiMessage && customAiMessage.trim().length > 0) {
      return customAiMessage;
    }

    const names = lines
      .map(({ item, qty, note }) => {
        const num = getDishNumber(item);
        const noteStr = note ? ` [${note}]` : "";
        return lang === "zh"
          ? `${qty}份 #${num}号 ${getDishName(item)}${noteStr} (${formatRM(item.price * qty)})`
          : `${qty}x #${num} ${getDishName(item)}${noteStr} (${formatRM(item.price * qty)})`;
      })
      .join(", ");

    const typeWord =
      lang === "zh"
        ? type === "takeaway"
          ? "打包带走 (Tapau)"
          : "堂食 (Eat Here)"
        : lang === "ms"
        ? type === "takeaway"
          ? "Bungkus Tapau"
          : "Makan Sini"
        : type === "takeaway"
        ? "Takeaway (Tapau)"
        : "Eat Here";

    if (soldOutItem) {
      const soldName = getDishName(soldOutItem);
      if (lang === "zh") {
        return `不好意思，${soldName}今天卖完了！AI 为您推荐口味相近的：${names}，${typeWord}。请问您要改点这个吗？请说“要”或“不要”。`;
      }
      if (lang === "ms") {
        return `Maaf, ${soldName} sudah habis! AI cadangkan ${names}, ${typeWord}. Adakah anda mahu ini? Sebut Ya atau Tidak.`;
      }
      return `Sorry, ${soldName} is sold out! AI recommends ${names} for ${typeWord}. Would you like this instead? Say Yes or No.`;
    }

    if (lang === "zh") {
      return `AI 已听懂您的点餐：${names}，${typeWord}。请问确定要下单吗？请按绿色「是」或直接说“要”！`;
    }
    if (lang === "ms") {
      return `AI faham pesanan anda: ${names}, untuk ${typeWord}. Adakah anda pasti mahu ini? Tekan YA atau sebut 'Ya'!`;
    }
    return `AI understood your order: ${names}, for ${typeWord}. Would you like to confirm? Tap YES or say 'Yes'!`;
  }

  function openConfirmation(
    lines: MatchedOrderLine[],
    type: OrderType = orderType,
    soldOutItem?: MenuItem,
    customAiMessage?: string,
    userTranscript?: string
  ) {
    if (lines.length === 0) return;
    const prompt = buildReadbackPrompt(lines, type, soldOutItem, customAiMessage);
    setPendingConfirm({
      lines,
      orderType: type,
      isSoldOutAlternative: Boolean(soldOutItem),
      soldOutItemName: soldOutItem ? getDishName(soldOutItem) : undefined,
      spokenPrompt: prompt,
      userTranscript,
    });
    speakOutLoud(prompt);

    // Automatically listen for spoken "Yes / 要 / Ya" or "No / 不要 / Tidak"
    try {
      const win = window as unknown as Record<string, unknown>;
      const SpeechRecCtor = (win.SpeechRecognition || win.webkitSpeechRecognition) as
        | (new () => {
            lang: string;
            interimResults: boolean;
            continuous: boolean;
            onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
            start: () => void;
            stop: () => void;
          })
        | undefined;

      if (SpeechRecCtor) {
        confirmSpeechRecRef.current?.stop();
        const rec = new SpeechRecCtor();
        rec.lang = lang === "zh" ? "zh-CN" : lang === "ms" ? "ms-MY" : "en-MY";
        rec.interimResults = false;
        rec.continuous = false;
        rec.onresult = (event) => {
          const text = (event.results[0]?.[0]?.transcript ?? "").toLowerCase();
          if (NO_WORDS.some((w) => text.includes(w))) {
            handleConfirmNo();
          } else if (YES_WORDS.some((w) => text.includes(w))) {
            handleConfirmYes(lines, type);
          }
        };
        rec.start();
        confirmSpeechRecRef.current = rec;
      }
    } catch {
      // Optional voice Yes/No listener
    }
  }

  function handleConfirmYes(
    linesToConfirm = pendingConfirm?.lines ?? [],
    typeToConfirm = pendingConfirm?.orderType ?? orderType
  ) {
    confirmSpeechRecRef.current?.stop();
    if (linesToConfirm.length === 0) return;

    setOrderType(typeToConfirm);
    localStorage.setItem(`ezorder_type_${table}`, typeToConfirm);

    for (const line of linesToConfirm) {
      updateQty(line.item.id, line.qty, line.note);
    }

    const summaryNames = linesToConfirm
      .map((l) => `${l.qty}x ${getDishName(l.item)}${l.note ? ` (${l.note})` : ""}`)
      .join(", ");

    const typeLabel =
      lang === "zh"
        ? typeToConfirm === "takeaway"
          ? "打包"
          : "堂食"
        : lang === "ms"
        ? typeToConfirm === "takeaway"
          ? "Bungkus"
          : "Makan Sini"
        : typeToConfirm === "takeaway"
        ? "Takeaway"
        : "Eat Here";

    const successSpeech =
      lang === "zh"
        ? `好的！已为您确认 ${summaryNames}，${typeLabel}！`
        : lang === "ms"
        ? `Baik! ${summaryNames} (${typeLabel}) telah disahkan!`
        : `Confirmed! Added ${summaryNames} (${typeLabel}) to your order!`;

    speakOutLoud(successSpeech);
    setPendingConfirm(null);
    setVoiceOpen(false);
    setBanner(`${t.orderSentBanner} (${summaryNames} · ${typeLabel})`);
    setTimeout(() => setBanner(null), 4000);
  }

  function handleConfirmNo() {
    confirmSpeechRecRef.current?.stop();
    const cancelSpeech =
      lang === "zh"
        ? "好的，已经帮您取消。您可以重新按大麦克风告诉我您要吃什么。"
        : lang === "ms"
        ? "Baik, dibatalkan. Sila pilih atau sebut semula."
        : "Okay, cancelled! You can pick another dish or press the voice button again.";
    speakOutLoud(cancelSpeech);
    setPendingConfirm(null);
  }

  function hearCurrentDish() {
    if (!currentDish) return;
    const num = safeIndex + 1;
    const text =
      lang === "zh"
        ? `第 ${num} 号，${getDishName(currentDish)}，${getDishDesc(currentDish)}，价格 ${formatRM(
            currentDish.price
          )}。`
        : lang === "ms"
        ? `Hidangan nombor ${num}, ${getDishName(currentDish)}. ${getDishDesc(
            currentDish
          )}. Harga ${formatRM(currentDish.price)}.`
        : `Dish number ${num}, ${getDishName(currentDish)}. ${getDishDesc(
            currentDish
          )}. Price ${formatRM(currentDish.price)}.`;
    speakOutLoud(text);
  }

  // Intelligent Natural Language Analyzer (Handles recommendations, quantities, notes, takeaway, and sold-out!)
  function analyzeNaturalSpeech(
    spoken: string,
    serverData?: {
      intent?: string;
      orderType?: OrderType | null;
      message?: string;
      items?: Array<{ id?: string; dishId?: string; qty?: number; note?: string }>;
    }
  ) {
    const clean = spoken.toLowerCase().trim();

    // 1. If user is already on a confirmation screen and says Yes / No
    if (pendingConfirm) {
      if (
        serverData?.intent === "confirm_no" ||
        NO_WORDS.some((w) => clean.includes(w))
      ) {
        handleConfirmNo();
        return;
      }
      if (
        serverData?.intent === "confirm_yes" ||
        YES_WORDS.some((w) => clean.includes(w))
      ) {
        handleConfirmYes();
        return;
      }
    }

    // 2. Detect Takeaway vs Dine-In from speech or ILMU response
    let detectedType: OrderType = serverData?.orderType || orderType;
    if (TAKEAWAY_WORDS.some((w) => clean.includes(w))) {
      detectedType = "takeaway";
    } else if (DINE_IN_WORDS.some((w) => clean.includes(w))) {
      detectedType = "dine_in";
    }

    // 3. If YTL ILMU backend returned structured items, use them directly!
    if (serverData?.items && serverData.items.length > 0) {
      const lines: MatchedOrderLine[] = [];
      for (const entry of serverData.items) {
        const targetId = entry.id ?? entry.dishId;
        const found = menu.find((d) => d.id === targetId);
        if (found && found.inStock !== false) {
          lines.push({
            item: found,
            qty: entry.qty ?? extractSpokenQuantity(clean),
            note: entry.note ?? extractCustomNote(clean),
          });
        }
      }
      if (lines.length > 0) {
        setVoiceOpen(false);
        openConfirmation(
          lines,
          detectedType,
          serverData.intent === "sold_out" ? soldOutDishes[0] : undefined,
          serverData.message,
          spoken
        );
        return;
      }
    }

    // 4. Smart Client-Side NLU Fallback (never rigid / never fails in live demos!)
    if (!clean) {
      if (currentDish) {
        setVoiceOpen(false);
        openConfirmation([{ item: currentDish, qty: 1 }], detectedType);
      }
      return;
    }

    const defaultQty = extractSpokenQuantity(clean);
    const detectedNote = extractCustomNote(clean);
    const matchedIds = new Set<string>();
    const maxDish = availableDishes.length;

    // Match numbers ("1", "2", "12", "satu", "一号", Cantonese "yat", etc.)
    const digitGroups = clean.match(/\d+/g) ?? [];
    for (const group of digitGroups) {
      const asInt = parseInt(group, 10);
      if (asInt >= 1 && asInt <= maxDish) {
        const dish = availableDishes[asInt - 1];
        if (dish) matchedIds.add(dish.id);
      } else if (group.length > 1) {
        for (const ch of group.split("")) {
          const d = parseInt(ch, 10);
          if (d >= 1 && d <= maxDish) {
            const dish = availableDishes[d - 1];
            if (dish) matchedIds.add(dish.id);
          }
        }
      }
    }

    const words = clean.split(/[\s,.;!?/|+&-]+/);
    for (let num = 1; num <= maxDish; num++) {
      const tokens = NUMBER_WORDS[num] ?? [];
      for (const tok of tokens) {
        const isCjk = /[\u4e00-\u9fa5]/.test(tok);
        if (isCjk ? clean.includes(tok) : words.includes(tok)) {
          const dish = availableDishes[num - 1];
          if (dish) matchedIds.add(dish.id);
        }
      }
    }

    // Match dish names, descriptions, and taste intents ("not spicy", "recommend", "what is nice")
    let soldOutHit: MenuItem | undefined;
    for (const item of menu) {
      const extraNicknames =
        ((item as unknown as Record<string, unknown>).nicknames as string[] | undefined) ?? [];
      const keywords = [
        item.id.replace(/-/g, " "),
        item.name?.en,
        item.name?.ms,
        item.name?.zh,
        getDishDesc(item),
        ...extraNicknames,
        ...(DIALECT_KEYWORDS[item.id] ?? []),
      ]
        .filter(Boolean)
        .map((s) => String(s).toLowerCase());

      if (keywords.some((kw) => kw.length >= 2 && clean.includes(kw))) {
        if (item.inStock === false) {
          soldOutHit = item;
        } else {
          matchedIds.add(item.id);
        }
      }
    }

    // HandleSold-Out Dish Request -> Recommend closest available dish with Yes/No
    if (soldOutHit && matchedIds.size === 0) {
      const alt = availableDishes[0];
      if (alt) {
        setVoiceOpen(false);
        openConfirmation(
          [{ item: alt, qty: defaultQty, note: detectedNote }],
          detectedType,
          soldOutHit,
          undefined,
          spoken
        );
        return;
      }
    }

    if (matchedIds.size > 0) {
      const lines: MatchedOrderLine[] = availableDishes
        .filter((d) => matchedIds.has(d.id))
        .map((item) => ({
          item,
          qty: defaultQty,
          note: detectedNote,
        }));
      setVoiceOpen(false);
      openConfirmation(lines, detectedType, undefined, undefined, spoken);
      return;
    }

    // If user asked a general question like "what is good / 推荐 / sedap", recommend the chef's #1 dish!
    if (currentDish) {
      const recPrompt =
        lang === "zh"
          ? `您说了“${spoken}”。AI 为您推荐招牌 #${safeIndex + 1}号 ${getDishName(
              currentDish
            )}${detectedNote ? `（${detectedNote}）` : ""}，${
              detectedType === "takeaway" ? "打包带走" : "堂食"
            }。请问您要试试这道菜吗？请按「是」或「不要」。`
          : lang === "ms"
          ? `Anda sebut "${spoken}". AI cadangkan #${safeIndex + 1} ${getDishName(
              currentDish
            )}${detectedNote ? ` (${detectedNote})` : ""}. Adakah anda mahu ini? Tekan YA atau TIDAK.`
          : `You said "${spoken}". AI recommends our signature #${
              safeIndex + 1
            } ${getDishName(currentDish)}${
              detectedNote ? ` (${detectedNote})` : ""
            }. Would you like to order this? Tap YES or NO.`;

      setVoiceOpen(false);
      openConfirmation(
        [{ item: currentDish, qty: defaultQty, note: detectedNote }],
        detectedType,
        undefined,
        recPrompt,
        spoken
      );
    }
  }

  function buildMenuPayloadForAi() {
    return JSON.stringify(
      menu.map((item, i) => ({
        id: item.id,
        number: i + 1,
        nameEn: item.name?.en || "",
        nameMs: item.name?.ms || "",
        nameZh: item.name?.zh || "",
        price: item.price,
        inStock: item.inStock !== false,
        desc: getDishDesc(item),
      }))
    );
  }

  async function sendToIlmuApi(blob: Blob | null, textOverride?: string) {
    setVoiceMessage("🤖 YTL ILMU AI is thinking…");
    try {
      const form = new FormData();
      if (blob) {
        const ext = blob.type.includes("mp4") ? "order.m4a" : "order.webm";
        form.append("audio", blob, ext);
      }
      const spokenText = (textOverride ?? transcriptRef.current).trim();
      if (spokenText) {
        form.append("text", spokenText);
      }
      form.append("lang", lang);
      form.append("orderType", orderType);
      form.append("menu", buildMenuPayloadForAi());

      const res = await fetch("/api/voice", {
        method: "POST",
        body: form,
      });

      if (!res.ok) throw new Error("Fallback to local NLU");
      const data = (await res.json()) as {
        transcript?: string;
        intent?: string;
        orderType?: OrderType | null;
        message?: string;
        items?: Array<{ id?: string; dishId?: string; qty?: number; note?: string }>;
      };

      const finalSpoken = [spokenText, data.transcript].filter(Boolean).join(" ").trim();
      analyzeNaturalSpeech(finalSpoken, data);
    } catch {
      analyzeNaturalSpeech(textOverride ?? transcriptRef.current);
    }
  }

  async function startVoiceRecording() {
    setVoiceMessage(null);
    setLiveTranscript("");
    transcriptRef.current = "";
    setVoiceOpen(true);

    try {
      const win = window as unknown as Record<string, unknown>;
      const SpeechRecCtor = (win.SpeechRecognition || win.webkitSpeechRecognition) as
        | (new () => {
            lang: string;
            interimResults: boolean;
            continuous: boolean;
            onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
            start: () => void;
            stop: () => void;
          })
        | undefined;

      if (SpeechRecCtor) {
        const rec = new SpeechRecCtor();
        rec.lang = lang === "zh" ? "zh-CN" : lang === "ms" ? "ms-MY" : "en-MY";
        rec.interimResults = true;
        rec.continuous = true;
        rec.onresult = (event) => {
          const parts: string[] = [];
          for (let i = 0; i < event.results.length; i++) {
            const item = event.results[i]?.[0];
            if (item?.transcript) parts.push(item.transcript);
          }
          const joined = parts.join(" ");
          transcriptRef.current = joined;
          setLiveTranscript(joined);
        };
        rec.start();
        speechRecRef.current = rec;
      }
    } catch {
      // Browser SpeechRecognition optional
    }

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
        await sendToIlmuApi(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setRecording(false);
      setVoiceMessage("Microphone permission is off — type or tap any phrase below:");
    }
  }

  function stopVoiceRecording() {
    try {
      speechRecRef.current?.stop();
    } catch {
      // ignore
    }
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    } else {
      void sendToIlmuApi(null, transcriptRef.current);
    }
  }

  const shellClass =
    "mx-auto flex h-dvh max-h-dvh w-full max-w-md flex-col bg-[#f5f3ef] text-neutral-900 overflow-hidden pb-[max(0.4rem,env(safe-area-inset-bottom))]";

  if (mode === "choose") {
    const heroImage =
      availableDishes[0] ? getDishImage(availableDishes[0]) : "/menu/nasi-lemak.jpg";

    return (
      <div className={shellClass}>
        <header className="bg-[#f47521] px-4 py-2.5 flex items-center justify-between shrink-0">
          <p className="font-extrabold text-black text-base sm:text-lg">
            Kopitiam Sedap · {t.tableLabel(table)}
          </p>
        </header>

        <main className="flex-1 flex flex-col justify-between p-4 gap-3 overflow-y-auto">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 leading-tight">
              How do you want to order?
            </h1>
            <p className="text-base sm:text-lg font-bold text-neutral-600 mt-1">
              Bagaimana anda mahu pesan? · 您想怎样点餐？
            </p>
          </div>

          <div className="flex-1 flex flex-col justify-center gap-3">
            <button
              onClick={() => setMode("big")}
              className="w-full text-left bg-white border-[3px] border-[#f47521] rounded-3xl p-4 flex items-center gap-3.5 shadow-sm"
            >
              <div className="w-24 sm:w-28 shrink-0 bg-white rounded-2xl p-1.5 flex flex-col items-center gap-1.5">
                <img
                  src={heroImage}
                  alt="Big Photos Menu"
                  className="w-full aspect-square object-contain rounded-xl"
                />
                <span className="w-full bg-[#f47521] text-black font-extrabold text-center py-1 rounded-lg text-xs">
                  ✓
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl sm:text-2xl font-extrabold text-neutral-900">
                  Big Photos Menu
                </h2>
                <p className="text-base font-bold text-neutral-600 mt-1">
                  Menu Gambar Besar
                </p>
                <p className="text-base font-bold text-neutral-600">大图菜单</p>
              </div>
            </button>

            <button
              onClick={() => setMode("normal")}
              className="w-full text-left bg-white border-2 border-neutral-300 rounded-3xl p-4 flex items-center gap-3.5 shadow-sm"
            >
              <div className="w-24 sm:w-28 shrink-0 bg-neutral-100 rounded-2xl p-3 flex flex-col gap-2 justify-center aspect-square">
                <div className="h-2.5 bg-neutral-400 rounded-full" />
                <div className="h-2.5 bg-neutral-400 rounded-full" />
                <div className="h-2.5 bg-neutral-400 rounded-full" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg sm:text-xl font-extrabold text-neutral-900">
                  Normal Menu
                </h2>
                <p className="text-sm font-bold text-neutral-600 mt-1">
                  Menu Biasa · 普通菜单
                </p>
              </div>
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (mode === "normal") {
    return (
      <div className={shellClass}>
        <header className="bg-[#f47521] px-3 py-2 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setMode("choose")}
              className="px-2.5 h-8 shrink-0 rounded-xl border-2 border-black/80 flex items-center justify-center font-extrabold text-xs text-black"
            >
              &lt; {t.switchMenu}
            </button>
            <p className="font-extrabold text-black text-xs sm:text-sm truncate">
              Kopitiam Sedap · {t.tableLabel(table)}
            </p>
          </div>
          <button
            onClick={() => setMode("big")}
            className="bg-white text-black font-bold text-xs px-3 py-1.5 rounded-xl shrink-0"
          >
            {t.switchBig}
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
          {menu.map((item, idx) => {
            const qty = cart[item.id] ?? 0;
            const soldOut = item.inStock === false;
            const dishNum = idx + 1;
            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl p-2.5 flex items-center gap-3 shadow-sm ${
                  soldOut ? "opacity-75" : ""
                }`}
              >
                <div className="relative w-16 h-16 shrink-0 rounded-xl bg-white border border-neutral-200 overflow-hidden flex items-center justify-center">
                  <span className="absolute top-0.5 left-0.5 bg-neutral-900 text-white text-[11px] font-extrabold px-1.5 rounded-md">
                    #{dishNum}
                  </span>
                  <img
                    src={getDishImage(item)}
                    alt={getDishName(item)}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold text-base text-neutral-900 truncate">
                    #{dishNum} {getDishName(item)}
                  </p>
                  <p className="text-xs text-neutral-600 line-clamp-1">
                    {getDishDesc(item)}
                  </p>
                  <p className="text-sm font-extrabold text-neutral-900 mt-0.5">
                    {formatRM(item.price)}
                  </p>
                </div>

                {soldOut ? (
                  <span className="text-xs font-extrabold bg-amber-100 text-amber-900 px-2.5 py-1.5 rounded-lg shrink-0">
                    {t.soldOut}
                  </span>
                ) : (
                  <button
                    onClick={() => openConfirmation([{ item, qty: 1 }], orderType)}
                    className="h-9 px-3 rounded-xl bg-[#f47521] text-black font-extrabold text-xs shrink-0"
                  >
                    + Add {qty > 0 ? `(${qty})` : ""}
                  </button>
                )}
              </div>
            );
          })}
        </main>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // SCREEN 3: BIG PHOTOS MENU (With MASSIVE Bottom Voice AI Button + Yes/No AI)
  // ---------------------------------------------------------------------------
  const currentDishNum = safeIndex + 1;

  return (
    <div className={shellClass}>
      {/* Compact Header */}
      <header className="bg-[#f47521] px-2.5 py-1.5 flex items-center justify-between gap-1.5 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <button
            onClick={() => setMode("choose")}
            className="h-8 px-2 shrink-0 rounded-xl border-2 border-black/80 flex items-center justify-center text-xs font-extrabold text-black active:bg-black/10"
          >
            &lt; {t.switchMenu}
          </button>
          <div className="min-w-0 leading-tight">
            <p className="font-extrabold text-black text-xs sm:text-sm truncate">
              Kopitiam Sedap
            </p>
            <p className="text-[11px] font-bold text-black/90 truncate">
              {t.tableLabel(table)}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-0.5 flex items-center shrink-0 text-[11px] font-bold">
          <button
            onClick={() => setLang("en")}
            className={`px-2 py-1 rounded-lg ${
              lang === "en" ? "bg-neutral-900 text-white" : "text-neutral-900"
            }`}
          >
            English
          </button>
          <button
            onClick={() => setLang("ms")}
            className={`px-1.5 py-1 rounded-lg ${
              lang === "ms" ? "bg-neutral-900 text-white" : "text-neutral-900"
            }`}
          >
            Melayu
          </button>
          <button
            onClick={() => setLang("zh")}
            className={`px-1.5 py-1 rounded-lg ${
              lang === "zh" ? "bg-neutral-900 text-white" : "text-neutral-900"
            }`}
          >
            中文
          </button>
        </div>
      </header>

      {/* Top Bar: Dine-In vs Takeaway (Tapau) + Dish Numbers #1 #2 #3 #4 */}
      <div className="bg-white px-2.5 py-1.5 flex items-center justify-between gap-2 border-b border-neutral-200 shrink-0">
        <div className="grid grid-cols-2 bg-neutral-200 p-0.5 rounded-xl shrink-0 text-xs font-extrabold">
          <button
            onClick={() => changeOrderType("dine_in")}
            className={`px-2.5 py-1 rounded-lg transition ${
              orderType === "dine_in"
                ? "bg-neutral-900 text-white shadow-sm"
                : "text-neutral-700"
            }`}
          >
            {t.dineIn}
          </button>
          <button
            onClick={() => changeOrderType("takeaway")}
            className={`px-2.5 py-1 rounded-lg transition ${
              orderType === "takeaway"
                ? "bg-[#f47521] text-black shadow-sm"
                : "text-neutral-700"
            }`}
          >
            {t.takeaway}
          </button>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto">
          {availableDishes.map((item, i) => (
            <button
              key={item.id}
              onClick={() => setIndex(i)}
              className={`h-7 px-2 rounded-lg font-extrabold text-xs shrink-0 transition ${
                i === safeIndex
                  ? "bg-neutral-900 text-white"
                  : "bg-neutral-100 text-neutral-800 border border-neutral-300"
              }`}
            >
              #{i + 1}
            </button>
          ))}
        </div>
      </div>

      {banner && (
        <div className="bg-green-700 text-white text-xs sm:text-sm font-extrabold px-3 py-1.5 text-center shrink-0">
          {banner}
        </div>
      )}

      {problem && (
        <p className="bg-red-100 text-red-900 text-xs font-bold px-3 py-1 shrink-0">
          {problem}
        </p>
      )}

      {/* Elastic Main Content */}
      <main className="flex-1 min-h-0 flex flex-col justify-between p-2 sm:p-2.5 gap-1.5">
        {currentDish ? (
          <div className="bg-white rounded-2xl p-2.5 shadow-sm flex-1 min-h-0 flex flex-col justify-between overflow-hidden">
            <div className="relative w-full flex-1 min-h-[75px] rounded-xl overflow-hidden bg-white flex items-center justify-center">
              <span className="absolute top-1.5 left-1.5 z-10 bg-neutral-900 text-white font-extrabold text-sm px-2.5 py-0.5 rounded-xl shadow">
                #{currentDishNum}
              </span>
              <button
                onClick={hearCurrentDish}
                className="absolute top-1.5 right-1.5 z-10 bg-amber-100 hover:bg-amber-200 border border-amber-400 text-neutral-900 font-extrabold text-xs px-2.5 py-1 rounded-xl shadow-sm"
              >
                {t.hearDish}
              </button>
              <img
                src={getDishImage(currentDish)}
                alt={getDishName(currentDish)}
                className="w-full h-full object-contain"
              />
            </div>

            <div className="shrink-0 pt-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-neutral-500">
                <span>{t.dishOf(currentDishNum, availableDishes.length)}</span>
                <span className="text-[#d96416] font-extrabold">
                  {orderType === "takeaway" ? t.takeaway : t.dineIn}
                </span>
              </div>

              <h1 className="text-lg sm:text-xl font-extrabold text-neutral-900 leading-tight truncate mt-0.5">
                #{currentDishNum} {getDishName(currentDish)}
              </h1>

              <div className="flex items-end justify-between gap-2 mt-0.5">
                <p className="text-xs text-neutral-600 line-clamp-1 leading-snug flex-1">
                  {getDishDesc(currentDish)}
                </p>
                <span className="text-lg sm:text-xl font-extrabold text-neutral-900 shrink-0 leading-none">
                  {formatRM(currentDish.price)}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-6 flex-1 flex items-center justify-center text-center font-bold text-neutral-500">
            Loading menu…
          </div>
        )}

        {/* ================================================================= */}
        {/* BOTTOM CONTROLS: Compact Navigation + MASSIVE PRESS VOICE BUTTON  */}
        {/* ================================================================= */}
        <div className="shrink-0 flex flex-col gap-1.5">
          {/* Row 1: Prev | Add #Dish | Next | My Picks */}
          <div className="grid grid-cols-12 gap-1.5">
            <button
              onClick={() =>
                setIndex((i) =>
                  availableDishes.length > 0
                    ? (i - 1 + availableDishes.length) % availableDishes.length
                    : 0
                )
              }
              className="col-span-3 bg-neutral-200 active:bg-neutral-300 text-neutral-900 font-extrabold text-xs sm:text-sm py-2.5 rounded-xl"
            >
              {t.back}
            </button>

            <button
              onClick={() =>
                currentDish &&
                openConfirmation([{ item: currentDish, qty: 1 }], orderType)
              }
              disabled={!currentDish}
              className="col-span-4 bg-[#f47521] active:bg-[#d96416] text-black font-extrabold text-sm sm:text-base py-2.5 rounded-xl shadow-sm"
            >
              {t.iWantThis(currentDishNum)}
            </button>

            <button
              onClick={() =>
                setIndex((i) =>
                  availableDishes.length > 0
                    ? (i + 1) % availableDishes.length
                    : 0
                )
              }
              className="col-span-3 bg-white border-2 border-neutral-900 text-neutral-900 font-extrabold text-xs sm:text-sm py-2.5 rounded-xl"
            >
              {t.nextDish}
            </button>

            <button
              onClick={() => setShowPicks(true)}
              className="col-span-2 bg-neutral-900 text-white font-extrabold text-xs py-2.5 rounded-xl flex flex-col items-center justify-center leading-none"
            >
              <span>🛒</span>
              <span className="mt-0.5">{totalPicks}</span>
            </button>
          </div>

          {/* Row 2: GIANT HIGH-ATTENTION AI VOICE BUTTON AT THE VERY BOTTOM */}
          <button
            onClick={() => void startVoiceRecording()}
            className="w-full bg-neutral-900 hover:bg-neutral-800 active:scale-[0.99] text-white border-4 border-[#f47521] rounded-3xl py-3.5 sm:py-4 px-4 shadow-lg flex flex-col items-center justify-center gap-0.5 transition"
          >
            <span className="text-lg sm:text-xl font-black tracking-wide text-[#f47521] flex items-center gap-2">
              {t.giantVoiceBtn}
            </span>
            <span className="text-[11px] sm:text-xs font-bold text-neutral-200">
              {t.giantVoiceSub}
            </span>
          </button>
        </div>
      </main>

      {/* ===================================================================== */}
      {/* HIGH-ATTENTION YES / NO AI CONFIRMATION MODAL (Touch or Voice!)       */}
      {/* ===================================================================== */}
      {pendingConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3">
          <div className="bg-white w-full max-w-md rounded-3xl p-4 sm:p-5 flex flex-col gap-3 shadow-2xl border-4 border-[#f47521]">
            <div className="flex items-center justify-between gap-2">
              <span className="bg-amber-100 text-amber-950 font-extrabold text-xs px-3 py-1 rounded-full">
                {t.confirmTitle}
              </span>
              <button
                onClick={() => speakOutLoud(pendingConfirm.spokenPrompt)}
                className="bg-neutral-100 hover:bg-neutral-200 text-neutral-900 font-extrabold text-xs px-3 py-1 rounded-full"
              >
                {t.speakAgain}
              </button>
            </div>

            {pendingConfirm.userTranscript && (
              <p className="text-xs font-bold text-neutral-600 bg-neutral-100 px-3 py-1.5 rounded-xl">
                🎙️ You said: &ldquo;{pendingConfirm.userTranscript}&rdquo;
              </p>
            )}

            {pendingConfirm.isSoldOutAlternative && (
              <div className="bg-red-100 border-2 border-red-400 text-red-950 text-xs sm:text-sm font-extrabold p-2.5 rounded-2xl">
                ⚠️ {pendingConfirm.soldOutItemName} — {t.soldOut}!
              </div>
            )}

            {/* Matched Dish List with Quantity +/- & Custom Note */}
            <div className="flex flex-col gap-2 max-h-44 overflow-y-auto">
              {pendingConfirm.lines.map((line, idx) => {
                const num = getDishNumber(line.item);
                return (
                  <div
                    key={line.item.id}
                    className="flex items-center gap-3 bg-neutral-100 rounded-2xl p-2.5"
                  >
                    <img
                      src={getDishImage(line.item)}
                      alt={getDishName(line.item)}
                      className="w-14 h-14 rounded-xl object-contain bg-white shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-base sm:text-lg font-extrabold text-neutral-900 truncate">
                        #{num} {getDishName(line.item)}
                      </p>
                      {line.note && (
                        <p className="text-xs font-extrabold text-green-800 bg-green-100 inline-block px-2 py-0.5 rounded-md mt-0.5">
                          ✨ {line.note}
                        </p>
                      )}
                      <p className="text-sm font-extrabold text-[#d96416] mt-0.5">
                        {formatRM(line.item.price * line.qty)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => {
                          const updated = [...pendingConfirm.lines];
                          updated[idx] = {
                            ...line,
                            qty: Math.max(1, line.qty - 1),
                          };
                          setPendingConfirm({ ...pendingConfirm, lines: updated });
                        }}
                        className="w-8 h-8 rounded-lg bg-white border border-neutral-400 font-extrabold"
                      >
                        −
                      </button>
                      <span className="w-5 text-center font-extrabold text-sm">
                        {line.qty}
                      </span>
                      <button
                        onClick={() => {
                          const updated = [...pendingConfirm.lines];
                          updated[idx] = { ...line, qty: line.qty + 1 };
                          setPendingConfirm({ ...pendingConfirm, lines: updated });
                        }}
                        className="w-8 h-8 rounded-lg bg-[#f47521] text-black font-extrabold"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Dine-In vs Takeaway Switch inside Confirmation */}
            <div className="grid grid-cols-2 gap-2 bg-neutral-100 p-1.5 rounded-2xl">
              <button
                onClick={() =>
                  setPendingConfirm({ ...pendingConfirm, orderType: "dine_in" })
                }
                className={`py-2 rounded-xl font-extrabold text-sm transition ${
                  pendingConfirm.orderType === "dine_in"
                    ? "bg-neutral-900 text-white shadow"
                    : "text-neutral-700"
                }`}
              >
                {t.dineIn}
              </button>
              <button
                onClick={() =>
                  setPendingConfirm({ ...pendingConfirm, orderType: "takeaway" })
                }
                className={`py-2 rounded-xl font-extrabold text-sm transition ${
                  pendingConfirm.orderType === "takeaway"
                    ? "bg-[#f47521] text-black shadow"
                    : "text-neutral-700"
                }`}
              >
                {t.takeaway}
              </button>
            </div>

            {/* AI Spoken Readback Box */}
            <p className="text-sm font-bold text-neutral-900 bg-amber-50 border-2 border-amber-300 rounded-2xl p-3 leading-snug">
              🔊 {pendingConfirm.spokenPrompt}
            </p>

            <p className="text-xs font-extrabold text-center text-neutral-500">
              {t.voiceConfirmHint}
            </p>

            {/* GIANT YES / NO BUTTONS */}
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() =>
                  handleConfirmYes(pendingConfirm.lines, pendingConfirm.orderType)
                }
                className="w-full bg-green-600 hover:bg-green-700 active:scale-[0.99] text-white font-black text-xl py-4 rounded-2xl shadow-lg"
              >
                {t.yesConfirm}
              </button>
              <button
                onClick={handleConfirmNo}
                className="w-full bg-red-100 hover:bg-red-200 text-red-900 font-extrabold text-base py-3 rounded-2xl"
              >
                {t.noCancel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MY PICKS DRAWER                                                       */}
      {/* ===================================================================== */}
      {showPicks && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center p-2">
          <div className="bg-white w-full max-w-md rounded-3xl p-4 flex flex-col gap-3 max-h-[85dvh]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold">{t.myPicks}</h2>
                <p className="text-xs font-extrabold text-[#d96416]">
                  {orderType === "takeaway" ? t.takeaway : t.dineIn}
                </p>
              </div>
              <span className="text-xl font-extrabold">
                {formatRM(totalPrice)}
              </span>
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
                          #{getDishNumber(item)} {getDishName(item)}
                        </p>
                        {cartNotes[item.id] && (
                          <p className="text-xs font-bold text-green-800">
                            ✨ {cartNotes[item.id]}
                          </p>
                        )}
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

            {totalPicks > 0 && (
              <button
                onClick={() => {
                  const summaryText =
                    lang === "zh"
                      ? `您的订单共有 ${totalPicks} 份餐点，${
                          orderType === "takeaway" ? "打包带走" : "堂食"
                        }，总计 ${formatRM(totalPrice)}。已经送往厨房！`
                      : lang === "ms"
                      ? `Pesanan anda (${totalPicks} hidangan, ${
                          orderType === "takeaway" ? "Bungkus" : "Makan Sini"
                        }) berjumlah ${formatRM(totalPrice)} telah dihantar ke dapur!`
                      : `Your order of ${totalPicks} dishes (${
                          orderType === "takeaway" ? "Takeaway" : "Eat Here"
                        }), total ${formatRM(totalPrice)}, has been sent to the kitchen!`;
                  speakOutLoud(summaryText);
                  setShowPicks(false);
                  setBanner(summaryText);
                  setTimeout(() => setBanner(null), 4000);
                }}
                className="w-full bg-green-600 text-white font-extrabold text-base py-3.5 rounded-2xl shadow"
              >
                {t.sendOrderNow}
              </button>
            )}

            <button
              onClick={() => setShowPicks(false)}
              className="w-full bg-neutral-900 text-white font-extrabold text-base py-3 rounded-2xl"
            >
              ⬅️ {t.close}
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* INTELLIGENT CONVERSATIONAL VOICE MODAL (Not Rigid / Live + Chat Box)  */}
      {/* ===================================================================== */}
      {voiceOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-end justify-center p-2">
          <div className="bg-white w-full max-w-md rounded-3xl p-4 flex flex-col gap-2.5 max-h-[90dvh]">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-neutral-900">
                🎙️ YTL ILMU Voice AI
              </h2>
              {recording && (
                <span className="bg-red-600 text-white text-xs font-extrabold px-2.5 py-1 rounded-full animate-pulse">
                  ● REC
                </span>
              )}
            </div>

            <div className="bg-amber-50 border-2 border-amber-300 text-neutral-900 rounded-2xl p-3">
              <p className="text-sm font-extrabold">
                {recording ? t.listening : voiceMessage || t.listening}
              </p>
              {liveTranscript && (
                <p className="text-base font-black text-[#d96416] mt-1">
                  &ldquo;{liveTranscript}&rdquo;
                </p>
              )}
            </div>

            <p className="text-xs font-semibold text-neutral-500">
              {t.voiceHint}
            </p>

            {/* Free-form Natural Input Box (So you can also type anything live in front of judges!) */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!manualInput.trim()) return;
                stopVoiceRecording();
                void sendToIlmuApi(null, manualInput);
                setManualInput("");
              }}
              className="flex gap-1.5"
            >
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder={t.typeOrSpeakPlaceholder}
                className="flex-1 rounded-xl border-2 border-neutral-300 px-3 py-2 text-sm font-bold"
              />
              <button
                type="submit"
                className="bg-neutral-900 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl shrink-0"
              >
                {t.askAiBtn}
              </button>
            </form>

            {/* Natural Malaysian Conversation Examples (One-Tap for noisy demo halls) */}
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              <button
                onClick={() => {
                  stopVoiceRecording();
                  void sendToIlmuApi(null, "我要两份 1号 椰浆饭 不要花生 少辣 打包");
                }}
                className="text-xs font-extrabold bg-orange-100 text-orange-950 px-2.5 py-1.5 rounded-xl border border-orange-300"
              >
                🗣️ &ldquo;两份 #1 椰浆饭 不要花生 打包&rdquo;
              </button>
              <button
                onClick={() => {
                  stopVoiceRecording();
                  void sendToIlmuApi(null, "Uncle, bagi 1 dan 2 bungkus tapau kurang pedas");
                }}
                className="text-xs font-extrabold bg-orange-100 text-orange-950 px-2.5 py-1.5 rounded-xl border border-orange-300"
              >
                🗣️ &ldquo;Bagi #1 &amp; #2 tapau kurang pedas&rdquo;
              </button>
              <button
                onClick={() => {
                  stopVoiceRecording();
                  void sendToIlmuApi(null, "有什么不辣的好吃推荐？堂食");
                }}
                className="text-xs font-extrabold bg-amber-100 text-amber-950 px-2.5 py-1.5 rounded-xl border border-amber-300"
              >
                🗣️ &ldquo;有什么不辣的推荐？堂食&rdquo;
              </button>
              {soldOutDishes[0] && (
                <button
                  onClick={() => {
                    stopVoiceRecording();
                    void sendToIlmuApi(null, `我要 ${getDishName(soldOutDishes[0])} 打包`);
                  }}
                  className="text-xs font-extrabold bg-red-100 text-red-950 px-2.5 py-1.5 rounded-xl border border-red-300"
                >
                  🗣️ Ask for Sold-Out ({getDishName(soldOutDishes[0])})
                </button>
              )}
            </div>

            {recording && (
              <button
                onClick={stopVoiceRecording}
                className="w-full bg-[#f47521] text-black font-black text-lg py-4 rounded-2xl shadow-md"
              >
                {t.stopAndMatch}
              </button>
            )}

            <button
              onClick={() => {
                stopVoiceRecording();
                setVoiceOpen(false);
              }}
              className="w-full bg-neutral-200 text-neutral-900 font-extrabold text-base py-3 rounded-2xl"
            >
              ⬅️ {t.cancel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}