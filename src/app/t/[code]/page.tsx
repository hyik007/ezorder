"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { formatRM } from "@/lib/menu";
import { store } from "@/lib/store";
import type { MenuItem } from "@/lib/types";

type Lang = "en" | "ms" | "zh";
type ViewMode = "choose" | "big" | "normal";
type OrderType = "dine_in" | "takeaway";

interface PendingConfirmation {
  items: MenuItem[];
  orderType: OrderType;
  isSoldOutAlternative?: boolean;
  soldOutItemName?: string;
  spokenPrompt: string;
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
    sayOrder: string;
    confirmTitle: string;
    yesConfirm: string;
    noCancel: string;
    speakAgain: string;
    voiceConfirmHint: string;
    listening: string;
    voiceHint: string;
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
    iWantThis: (num) => `✓ I want #${num}`,
    back: "Prev",
    nextDish: "Next dish ➔",
    myPicks: "My picks",
    sayOrder: "Voice Order",
    confirmTitle: "Please Confirm Your Order",
    yesConfirm: "✓ YES, I WANT THIS",
    noCancel: "✕ NO, CHANGE",
    speakAgain: "🔊 Read back again",
    voiceConfirmHint: "Tap YES / NO or say 'Yes' or 'No'",
    listening: "Listening… say dish # (1, 2, 3), name, or 'Tapau / Eat here'",
    voiceHint: "Understands English, Malay, Mandarin, Cantonese, Hokkien & Rojak",
    stopAndMatch: "✓ Done speaking",
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
    dishOf: (i, total) => `Hidangan #${i} daripada ${total}`,
    hearDish: "🔊 Dengar",
    iWantThis: (num) => `✓ Saya mahu #${num}`,
    back: "Sebelum",
    nextDish: "Seterusnya ➔",
    myPicks: "Pilihan",
    sayOrder: "Pesanan Suara",
    confirmTitle: "Sila Sahkan Pesanan Anda",
    yesConfirm: "✓ YA, SAYA MAHU INI",
    noCancel: "✕ TIDAK, TUKAR",
    speakAgain: "🔊 Dengar semula",
    voiceConfirmHint: "Tekan YA / TIDAK atau sebut 'Ya' / 'Tidak'",
    listening: "Mendengar… sebut nombor (1, 2, 3), nama hidangan, atau 'Bungkus'",
    voiceHint: "Faham Bahasa Melayu, Inggeris, Cina, Kantonis & Rojak",
    stopAndMatch: "✓ Siap bercakap",
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
    iWantThis: (num) => `✓ 我要 #${num} 号这道菜`,
    back: "上一道",
    nextDish: "下一道菜 ➔",
    myPicks: "我点的",
    sayOrder: "说出您要点的",
    confirmTitle: "请确认您的点餐",
    yesConfirm: "✓ 是，我要这个 (YES)",
    noCancel: "✕ 不要，换别的 (NO)",
    speakAgain: "🔊 再听一次",
    voiceConfirmHint: "请按「是」或「不要」，也可以直接说“要”或“不要”",
    listening: "请说话… 可说号码（如 1号、2号）、菜名，或说“打包 / 堂食”",
    voiceHint: "支持华语、广东话、福建话、马来语、英语混着说",
    stopAndMatch: "✓ 说完了，帮我点餐",
    cancel: "返回菜单",
    switchBig: "大图菜单",
    tableOrder: "本桌已选餐点",
    emptyPicks: "还没有点菜。",
    close: "返回菜单",
    soldOut: "已售罄",
    orderSentBanner: "✓ 已确认加入点餐单！",
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
  7: ["7", "seven", "seventh", "tujuh", "ketujuh", "七", "七号", "7号", "第七", "chat", "chit"],
  8: ["8", "eight", "eighth", "lapan", "kelapan", "八", "八号", "8号", "第八", "baat", "pat"],
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
  "nasi-lemak": ["nasi lemak", "nasilemak", "lemak", "椰浆饭", "辣死你妈", "lah si", "ayam goreng"],
  "char-kuey-teow": ["char kuey teow", "char kway teow", "ckt", "chao guo tiao", "炒粿条", "炒贵刁", "kuey teow", "guetiau"],
  "hainanese-chicken-rice": ["chicken rice", "nasi ayam", "kai fan", "gai fan", "鸡饭", "海南鸡饭", "白斩鸡"],
  "laksa": ["laksa", "curry laksa", "asam laksa", "叻沙", "咖喱面", "curry mee"],
  "roti-canai": ["roti", "roti canai", "roti kosong", "印度煎饼", "canai"],
  "teh-tarik": ["teh tarik", "teh", "teh peng", "teh c", "拉茶", "奶茶"],
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
  const [showPicks, setShowPicks] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirmation | null>(null);

  const [voiceOpen, setVoiceOpen] = useState(false);
  const [recording, setRecording] = useState(false);
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
        utter.rate = 0.92;
        utter.pitch = 1.0;
        window.speechSynthesis.speak(utter);
      } catch {
        // Ignore TTS errors if blocked
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
          ? "已切换为打包带走"
          : "已切换为堂食"
        : lang === "ms"
        ? nextType === "takeaway"
          ? "Ditukar kepada Bungkus Tapau"
          : "Ditukar kepada Makan Sini"
        : nextType === "takeaway"
        ? "Switched to Takeaway Tapau"
        : "Switched to Eat Here";
    speakOutLoud(spoken);
  }

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

  function buildReadbackPrompt(
    items: MenuItem[],
    type: OrderType,
    soldOutItem?: MenuItem
  ): string {
    const names = items
      .map((item) => {
        const num = getDishNumber(item);
        return lang === "zh"
          ? `${num}号 ${getDishName(item)} (${formatRM(item.price)})`
          : `#${num} ${getDishName(item)} (${formatRM(item.price)})`;
      })
      .join(", ");

    const typeWord =
      lang === "zh"
        ? type === "takeaway"
          ? "打包带走"
          : "堂食"
        : lang === "ms"
        ? type === "takeaway"
          ? "Bungkus Tapau"
          : "Makan Sini"
        : type === "takeaway"
        ? "Takeaway Tapau"
        : "Eat Here";

    if (soldOutItem) {
      const soldName = getDishName(soldOutItem);
      if (lang === "zh") {
        return `不好意思，${soldName}今天卖完了！为您推荐 ${names}，${typeWord}。请问您要改点这个吗？请按「是」或「不要」。`;
      }
      if (lang === "ms") {
        return `Maaf, ${soldName} sudah habis hari ini. Cuba ${names}, ${typeWord}. Adakah anda mahu ini? Sila tekan Ya atau Tidak.`;
      }
      return `Sorry, ${soldName} is sold out today! Would you like ${names} instead, for ${typeWord}? Tap Yes or No.`;
    }

    if (lang === "zh") {
      return `您选了 ${names}，${typeWord}。请问确定要这个吗？请按绿色「是」确认，或按「不要」重选。`;
    }
    if (lang === "ms") {
      return `Anda pilih ${names}, untuk ${typeWord}. Adakah anda pasti mahu ini? Sila tekan Ya atau Tidak.`;
    }
    return `You picked ${names}, for ${typeWord}. Do you want to confirm this order? Please tap Yes or No.`;
  }

  function openConfirmation(
    items: MenuItem[],
    type: OrderType = orderType,
    soldOutItem?: MenuItem
  ) {
    if (items.length === 0) return;
    const prompt = buildReadbackPrompt(items, type, soldOutItem);
    setPendingConfirm({
      items,
      orderType: type,
      isSoldOutAlternative: Boolean(soldOutItem),
      soldOutItemName: soldOutItem ? getDishName(soldOutItem) : undefined,
      spokenPrompt: prompt,
    });
    speakOutLoud(prompt);

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
            handleConfirmYes(items, type);
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
    itemsToConfirm = pendingConfirm?.items ?? [],
    typeToConfirm = pendingConfirm?.orderType ?? orderType
  ) {
    confirmSpeechRecRef.current?.stop();
    if (itemsToConfirm.length === 0) return;

    setOrderType(typeToConfirm);
    localStorage.setItem(`ezorder_type_${table}`, typeToConfirm);

    for (const item of itemsToConfirm) {
      updateQty(item.id, 1);
    }

    const names = itemsToConfirm.map((d) => getDishName(d)).join(", ");
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
        ? `好的！已为您加入 ${names}，${typeLabel}。`
        : lang === "ms"
        ? `Baik! ${names} (${typeLabel}) telah ditambah.`
        : `Confirmed! Added ${names} (${typeLabel}) to your order.`;

    speakOutLoud(successSpeech);
    setPendingConfirm(null);
    setVoiceOpen(false);
    setBanner(`${t.orderSentBanner} (${names} · ${typeLabel})`);
    setTimeout(() => setBanner(null), 3500);
  }

  function handleConfirmNo() {
    confirmSpeechRecRef.current?.stop();
    const cancelSpeech =
      lang === "zh"
        ? "好的，已取消，请重新选择。"
        : lang === "ms"
        ? "Dibatalkan. Sila pilih hidangan lain."
        : "Okay, cancelled. Please choose another dish.";
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
          )}。如果要选这道菜，请按橘色按钮。`
        : lang === "ms"
        ? `Hidangan nombor ${num}, ${getDishName(currentDish)}. ${getDishDesc(
            currentDish
          )}. Harga ${formatRM(currentDish.price)}.`
        : `Dish number ${num}, ${getDishName(currentDish)}. ${getDishDesc(
            currentDish
          )}. Price ${formatRM(currentDish.price)}.`;
    speakOutLoud(text);
  }

  function processSpokenTranscript(spoken: string) {
    const clean = spoken.toLowerCase().trim();
    if (!clean) {
      if (currentDish) {
        openConfirmation([currentDish], orderType);
      }
      return;
    }

    let detectedType: OrderType = orderType;
    if (TAKEAWAY_WORDS.some((w) => clean.includes(w))) {
      detectedType = "takeaway";
    } else if (DINE_IN_WORDS.some((w) => clean.includes(w))) {
      detectedType = "dine_in";
    }

    const matchedIds = new Set<string>();
    const maxDish = availableDishes.length;

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

    let soldOutHit: MenuItem | undefined;
    for (const item of menu) {
      const extraNicknames =
        ((item as unknown as Record<string, unknown>).nicknames as string[] | undefined) ?? [];
      const keywords = [
        item.id.replace(/-/g, " "),
        item.name?.en,
        item.name?.ms,
        item.name?.zh,
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

    if (soldOutHit && matchedIds.size === 0) {
      const alternative = availableDishes[0];
      if (alternative) {
        setVoiceOpen(false);
        openConfirmation([alternative], detectedType, soldOutHit);
        return;
      }
    }

    if (matchedIds.size > 0) {
      const matchedItems = availableDishes.filter((d) => matchedIds.has(d.id));
      setVoiceOpen(false);
      openConfirmation(matchedItems, detectedType);
      return;
    }

    if (currentDish) {
      setVoiceOpen(false);
      openConfirmation([currentDish], detectedType);
    }
  }

  async function startVoiceRecording() {
    setVoiceMessage(null);
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
          transcriptRef.current = parts.join(" ");
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
        await sendAudioToIlmu(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setRecording(false);
      setVoiceMessage("Tap a quick voice command below:");
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
      processSpokenTranscript(transcriptRef.current);
    }
  }

  async function sendAudioToIlmu(blob: Blob) {
    setVoiceMessage("ILMU AI is matching your voice order…");
    try {
      const form = new FormData();
      const ext = blob.type.includes("mp4") ? "order.m4a" : "order.webm";
      form.append("audio", blob, ext);
      form.append("table", table);

      const res = await fetch("/api/voice", {
        method: "POST",
        body: form,
      });

      if (!res.ok) throw new Error("Fallback to local matcher");
      const data = (await res.json()) as {
        transcript?: string;
        text?: string;
        orderType?: OrderType;
        items?: Array<{ id?: string; dishId?: string; qty?: number }>;
      };

      const combined = [data.transcript, data.text, transcriptRef.current]
        .filter(Boolean)
        .join(" ")
        .trim();

      if (combined) {
        processSpokenTranscript(combined);
        return;
      }

      if (data.items && data.items.length > 0) {
        const ids = new Set(data.items.map((x) => x.id ?? x.dishId));
        const matched = availableDishes.filter((d) => ids.has(d.id));
        if (matched.length > 0) {
          setVoiceOpen(false);
          openConfirmation(matched, data.orderType ?? orderType);
          return;
        }
      }

      processSpokenTranscript(transcriptRef.current);
    } catch {
      processSpokenTranscript(transcriptRef.current);
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
                    onClick={() => openConfirmation([item], orderType)}
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

  const currentDishNum = safeIndex + 1;

  return (
    <div className={shellClass}>
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

      <main className="flex-1 min-h-0 flex flex-col justify-between p-2 sm:p-3 gap-1.5">
        {currentDish ? (
          <div className="bg-white rounded-2xl p-2.5 sm:p-3 shadow-sm flex-1 min-h-0 flex flex-col justify-between overflow-hidden">
            <div className="relative w-full flex-1 min-h-[85px] rounded-xl overflow-hidden bg-white flex items-center justify-center">
              <span className="absolute top-1.5 left-1.5 z-10 bg-neutral-900 text-white font-extrabold text-sm sm:text-base px-2.5 py-0.5 rounded-xl shadow">
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
              <div className="flex items-center justify-between text-[11px] sm:text-xs font-bold text-neutral-500">
                <span>{t.dishOf(currentDishNum, availableDishes.length)}</span>
                <span className="text-[#d96416] font-extrabold">
                  {orderType === "takeaway" ? t.takeaway : t.dineIn}
                </span>
              </div>

              <h1 className="text-xl sm:text-2xl font-extrabold text-neutral-900 leading-tight truncate mt-0.5">
                #{currentDishNum} {getDishName(currentDish)}
              </h1>

              <div className="flex items-end justify-between gap-2 mt-0.5">
                <p className="text-xs sm:text-sm text-neutral-600 line-clamp-2 leading-snug flex-1">
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

        <div className="shrink-0 flex flex-col gap-1.5">
          <button
            onClick={() => currentDish && openConfirmation([currentDish], orderType)}
            disabled={!currentDish}
            className="w-full bg-[#f47521] active:bg-[#d96416] text-black font-extrabold text-lg sm:text-xl py-2.5 rounded-2xl shadow-sm transition disabled:opacity-40"
          >
            {t.iWantThis(currentDishNum)}
          </button>

          <div className="grid grid-cols-3 gap-1.5">
            <button
              onClick={() =>
                setIndex((i) =>
                  availableDishes.length > 0
                    ? (i - 1 + availableDishes.length) % availableDishes.length
                    : 0
                )
              }
              className="col-span-1 bg-neutral-200 active:bg-neutral-300 text-neutral-800 font-bold text-sm sm:text-base py-2 rounded-2xl"
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
              className="col-span-2 bg-white border-2 border-neutral-900 text-neutral-900 font-extrabold text-base sm:text-lg py-2 rounded-2xl active:bg-neutral-100"
            >
              {t.nextDish}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => setShowPicks(true)}
              className="bg-neutral-900 text-white font-bold text-sm sm:text-base py-2 px-2.5 rounded-2xl flex items-center justify-center gap-1.5"
            >
              <span className="truncate">{t.myPicks}</span>
              <span className="bg-white text-black rounded-full px-2 py-0.5 text-xs font-extrabold shrink-0">
                {totalPicks}
              </span>
            </button>

            <button
              onClick={() => void startVoiceRecording()}
              className="bg-white border-2 border-neutral-900 text-neutral-900 font-extrabold text-xs sm:text-sm py-2 px-2.5 rounded-2xl flex items-center justify-center gap-1.5 leading-tight"
            >
              <span aria-hidden="true" className="text-base shrink-0">
                🎙️
              </span>
              <span className="truncate">{t.sayOrder}</span>
            </button>
          </div>
        </div>
      </main>

      {pendingConfirm && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-3">
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

            {pendingConfirm.isSoldOutAlternative && (
              <div className="bg-red-100 border-2 border-red-400 text-red-950 text-xs sm:text-sm font-extrabold p-2.5 rounded-2xl">
                ⚠️ {pendingConfirm.soldOutItemName} — {t.soldOut}!
              </div>
            )}

            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
              {pendingConfirm.items.map((item) => {
                const num = getDishNumber(item);
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 bg-neutral-100 rounded-2xl p-2.5"
                  >
                    <img
                      src={getDishImage(item)}
                      alt={getDishName(item)}
                      className="w-16 h-16 rounded-xl object-contain bg-white shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-extrabold text-neutral-900 truncate">
                        #{num} {getDishName(item)}
                      </p>
                      <p className="text-base font-extrabold text-[#d96416]">
                        {formatRM(item.price)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

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

            <p className="text-sm font-bold text-neutral-800 bg-amber-50 border border-amber-200 rounded-2xl p-3 leading-snug">
              🔊 &ldquo;{pendingConfirm.spokenPrompt}&rdquo;
            </p>

            <p className="text-xs font-extrabold text-center text-neutral-500">
              {t.voiceConfirmHint}
            </p>

            <div className="flex flex-col gap-2">
              <button
                onClick={() =>
                  handleConfirmYes(pendingConfirm.items, pendingConfirm.orderType)
                }
                className="w-full bg-green-600 active:bg-green-700 text-white font-extrabold text-xl py-4 rounded-2xl shadow-md"
              >
                {t.yesConfirm}
              </button>
              <button
                onClick={handleConfirmNo}
                className="w-full bg-neutral-200 active:bg-neutral-300 text-neutral-900 font-extrabold text-lg py-3 rounded-2xl"
              >
                {t.noCancel}
              </button>
            </div>
          </div>
        </div>
      )}

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
                      ? `您的订单共有 ${totalPicks} 道菜，${
                          orderType === "takeaway" ? "打包带走" : "堂食"
                        }，总计 ${formatRM(totalPrice)}。已送往厨房！`
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

      {voiceOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center p-2">
          <div className="bg-white w-full max-w-md rounded-3xl p-4 flex flex-col gap-2.5 max-h-[88dvh]">
            <h2 className="text-xl font-extrabold">🎙️ {t.sayOrder}</h2>
            <p className="text-sm font-bold bg-amber-50 border border-amber-200 text-neutral-900 rounded-xl p-2.5">
              {recording ? t.listening : voiceMessage || t.listening}
            </p>
            <p className="text-xs font-semibold text-neutral-500">
              {t.voiceHint}
            </p>

            <div className="flex flex-wrap gap-1.5 pt-1">
              <button
                onClick={() => {
                  stopVoiceRecording();
                  processSpokenTranscript("我要 1号 椰浆饭 打包");
                }}
                className="text-xs font-extrabold bg-orange-100 text-orange-950 px-2.5 py-1.5 rounded-xl border border-orange-300"
              >
                🗣️ &ldquo;我要 1号 椰浆饭 打包&rdquo;
              </button>
              <button
                onClick={() => {
                  stopVoiceRecording();
                  processSpokenTranscript("Saya nak 1 dan 2 bungkus tapau");
                }}
                className="text-xs font-extrabold bg-orange-100 text-orange-950 px-2.5 py-1.5 rounded-xl border border-orange-300"
              >
                🗣️ &ldquo;Nak #1 &amp; #2 tapau&rdquo;
              </button>
              <button
                onClick={() => {
                  stopVoiceRecording();
                  processSpokenTranscript("I want 1 2 eat here");
                }}
                className="text-xs font-extrabold bg-orange-100 text-orange-950 px-2.5 py-1.5 rounded-xl border border-orange-300"
              >
                🗣️ &ldquo;I want #1 &amp; #2 eat here&rdquo;
              </button>
              {soldOutDishes[0] && (
                <button
                  onClick={() => {
                    stopVoiceRecording();
                    processSpokenTranscript(getDishName(soldOutDishes[0]));
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
                className="w-full bg-[#f47521] text-black font-extrabold text-lg py-3.5 rounded-2xl shadow"
              >
                {t.stopAndMatch}
              </button>
            )}

            <button
              onClick={() => {
                stopVoiceRecording();
                setVoiceOpen(false);
              }}
              className="w-full bg-neutral-900 text-white font-extrabold text-base py-3 rounded-2xl"
            >
              ⬅️ {t.cancel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
