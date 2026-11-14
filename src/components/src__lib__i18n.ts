import type { Lang, NoteKey } from "./types";

export const LANG_LABEL: Record<Lang, string> = { en: "English", ms: "Melayu", zh: "中文" };

/** Tap-to-pick names so nobody has to type. */
export const NAME_CHOICES = ["阿公 Ah Gong", "阿嬷 Ah Ma", "Atuk", "Nenek", "Uncle", "Auntie"];

export const NOTE_LABEL: Record<NoteKey, Record<Lang, string>> = {
  "less-sweet": { en: "Less sweet", ms: "Kurang manis", zh: "少甜" },
  "no-sugar": { en: "No sugar", ms: "Tanpa gula", zh: "无糖" },
  "not-spicy": { en: "Not spicy", ms: "Tidak pedas", zh: "不辣" },
  iced: { en: "Iced", ms: "Ais", zh: "冰" },
  takeaway: { en: "Takeaway", ms: "Bungkus", zh: "打包" },
  hot: { en: "Hot", ms: "Panas", zh: "热" },
};

type Strings = {
  whoTitle: string;
  whoHelp: string;
  want: string;
  next: string;
  back: string;
  added: string;
  addedToTable: string;
  payNote: string;
  payNoteGroup: string;
  aloneTitle: string;
  aloneHelp: string;
  yesSend: string;
  notYet: string;
  switchToNormal: string;
  switchToEasy: string;
  table: (code: string) => string;
  menu: string;
  add: string;
  tableOrder: string;
  emptyCart: string;
  nothingNew: string;
  nothingToSend: string;
  itemsFrom: (items: number, people: number) => string;
  send: string;
  sending: string;
  sent: string;
  payAfter: string;
  yourName: string;
  all: string;
  recording: string;
  voiceFailed: string;
  aiFallback: string;
  sayAgain: string;
  chooseAnother: string;
  didYouMean: string;
  allDishes: string;
  tapToAdd: string;
  addThese: string;
  soldOut: string;
  soldOutIs: (dish: string) => string;
  tryInstead: string;
  backToChoice: string;
  menuChoice: string;
  guest: string;
  byVoice: string;
  speak: string;
  /** Fits on the small voice button beside "My picks". */
  speakShort: string;
  listening: string;
  stopListening: string;
  heard: string;
  isThisRight: string;
  yesAdd: string;
  tryAgain: string;
  cancel: string;
  notFound: string;
  noMic: string;
  typeInstead: string;
  typePlaceholder: string;
  find: string;
  speechLang: string;
  myPicks: string;
  nothingYet: string;
  seenAll: string;
  lookAgain: string;
  dishOf: (n: number, total: number) => string;
  orderSent: string;
  stages: [string, string, string, string];
  orderMore: string;
  remove: string;
  oneMore: string;
  close: string;
  loading: string;
  changeName: string;
};

export const T: Record<Lang, Strings> = {
  en: {
    whoTitle: "Who is ordering?",
    whoHelp: "Tap your name.",
    want: "I want this",
    next: "Next dish",
    back: "Back",
    added: "Added",
    addedToTable: "Added to the table’s order",
    payNote: "When you are ready, send your order to the kitchen. You pay at the counter after your meal.",
    payNoteGroup: "Others at your table are ordering too. They can send the order, or you can.",
    aloneTitle: "Send this order to the kitchen now?",
    aloneHelp: "You pay at the counter after your meal.",
    yesSend: "Yes, send it",
    notYet: "Not yet",
    switchToNormal: "Normal Menu",
    switchToEasy: "Big Photos Menu",
    table: (c) => `Table ${c}`,
    menu: "Menu",
    add: "Add",
    tableOrder: "This table’s order",
    emptyCart: "Nothing yet. Picks from every phone at this table appear here.",
    nothingNew: "Nothing new since the last order.",
    nothingToSend: "Nothing to send yet",
    itemsFrom: (n, p) => `${n} ${n === 1 ? "item" : "items"} from ${p} ${p === 1 ? "person" : "people"}`,
    send: "Send to kitchen",
    sending: "Sending",
    sent: "Sent to kitchen",
    payAfter: "Pay at the counter after your meal.",
    yourName: "Your name",
    all: "All",
    recording: "Listening. Tap when you have finished.",
    voiceFailed: "I could not hear that clearly. Please try again, or type the order.",
    aiFallback: "The voice AI is busy. Speak again and this phone will listen.",
    sayAgain: "Say it again",
    chooseAnother: "Choose from photos",
    didYouMean: "Did you mean one of these?",
    allDishes: "All dishes",
    tapToAdd: "Tap the dish you want.",
    addThese: "Is this your order?",
    soldOut: "Sold out",
    soldOutIs: (d) => `Sorry, ${d} is finished today.`,
    tryInstead: "Try one of these instead?",
    backToChoice: "Change menu",
    menuChoice: "Menu style",
    guest: "Guest",
    byVoice: "ordered by voice",
    speak: "Say your order",
    speakShort: "Speak",
    listening: "Listening. Speak now.",
    stopListening: "I have finished speaking",
    heard: "I heard",
    isThisRight: "Is this right?",
    yesAdd: "Yes, add it",
    tryAgain: "No, try again",
    cancel: "Cancel",
    notFound: "That dish is not on this menu. Try again, or tap the photo of the dish.",
    noMic: "This phone cannot listen. Type the order instead.",
    typeInstead: "Or type the order",
    typePlaceholder: "two teh tarik, less sweet",
    find: "Find dish",
    speechLang: "I will speak in",
    myPicks: "My picks",
    nothingYet: "Nothing picked yet. Tap the green button under a dish you want.",
    seenAll: "You have seen every dish",
    lookAgain: "Look at the menu again",
    dishOf: (n, t) => `Dish ${n} of ${t}`,
    orderSent: "Order sent to the kitchen",
    stages: ["Order received", "Preparing", "Cooking", "Ready to serve"],
    orderMore: "Order more",
    remove: "Remove one",
    oneMore: "Add one more",
    close: "Close",
    loading: "Opening the menu",
    changeName: "Change name",
  },
  ms: {
    whoTitle: "Siapa yang memesan?",
    whoHelp: "Tekan nama anda.",
    want: "Saya mahu ini",
    next: "Hidangan seterusnya",
    back: "Kembali",
    added: "Ditambah",
    addedToTable: "Ditambah ke pesanan meja",
    payNote: "Apabila sudah sedia, hantar pesanan anda ke dapur. Bayar di kaunter selepas makan.",
    payNoteGroup: "Orang lain di meja anda juga sedang memesan. Mereka boleh hantar pesanan, atau anda sendiri.",
    aloneTitle: "Hantar pesanan ini ke dapur sekarang?",
    aloneHelp: "Bayar di kaunter selepas makan.",
    yesSend: "Ya, hantar",
    notYet: "Belum lagi",
    switchToNormal: "Menu Biasa",
    switchToEasy: "Menu Gambar Besar",
    table: (c) => `Meja ${c}`,
    menu: "Menu",
    add: "Tambah",
    tableOrder: "Pesanan meja ini",
    emptyCart: "Belum ada. Pilihan dari semua telefon di meja ini muncul di sini.",
    nothingNew: "Tiada yang baharu sejak pesanan terakhir.",
    nothingToSend: "Belum ada untuk dihantar",
    itemsFrom: (n, p) => `${n} hidangan daripada ${p} orang`,
    send: "Hantar ke dapur",
    sending: "Menghantar",
    sent: "Dihantar ke dapur",
    payAfter: "Bayar di kaunter selepas makan.",
    yourName: "Nama anda",
    all: "Semua",
    recording: "Sedang mendengar. Tekan apabila sudah habis.",
    voiceFailed: "Saya tidak dapat dengar dengan jelas. Sila cuba lagi, atau taip pesanan.",
    aiFallback: "AI suara sedang sibuk. Cakap sekali lagi, telefon ini akan mendengar.",
    sayAgain: "Cakap sekali lagi",
    chooseAnother: "Pilih dari gambar",
    didYouMean: "Adakah anda maksudkan salah satu ini?",
    allDishes: "Semua hidangan",
    tapToAdd: "Tekan hidangan yang anda mahu.",
    addThese: "Ini pesanan anda?",
    soldOut: "Habis",
    soldOutIs: (d) => `Maaf, ${d} sudah habis hari ini.`,
    tryInstead: "Cuba yang ini pula?",
    backToChoice: "Tukar menu",
    menuChoice: "Jenis menu",
    guest: "Tetamu",
    byVoice: "dipesan dengan suara",
    speak: "Sebut pesanan anda",
    speakShort: "Cakap",
    listening: "Sedang mendengar. Sila cakap.",
    stopListening: "Saya sudah habis cakap",
    heard: "Saya dengar",
    isThisRight: "Betul?",
    yesAdd: "Ya, tambah",
    tryAgain: "Tidak, cuba lagi",
    cancel: "Batal",
    notFound: "Hidangan itu tiada dalam menu ini. Cuba lagi, atau tekan gambar hidangan.",
    noMic: "Telefon ini tidak boleh mendengar. Taip pesanan.",
    typeInstead: "Atau taip pesanan",
    typePlaceholder: "dua teh tarik kurang manis",
    find: "Cari hidangan",
    speechLang: "Saya akan cakap dalam",
    myPicks: "Pilihan saya",
    nothingYet: "Belum ada pilihan. Tekan butang hijau di bawah hidangan yang anda mahu.",
    seenAll: "Anda sudah lihat semua hidangan",
    lookAgain: "Lihat menu sekali lagi",
    dishOf: (n, t) => `Hidangan ${n} daripada ${t}`,
    orderSent: "Pesanan dihantar ke dapur",
    stages: ["Pesanan diterima", "Sedang disediakan", "Sedang dimasak", "Siap dihidang"],
    orderMore: "Pesan lagi",
    remove: "Kurangkan satu",
    oneMore: "Tambah satu lagi",
    close: "Tutup",
    loading: "Membuka menu",
    changeName: "Tukar nama",
  },
  zh: {
    whoTitle: "谁在点餐？",
    whoHelp: "请按您的名字。",
    want: "我要这个",
    next: "下一道菜",
    back: "上一道",
    added: "已加入",
    addedToTable: "已加入本桌订单",
    payNote: "点好了，就可以把订单送到厨房。用餐后到柜台付款。",
    payNoteGroup: "同桌的人也在点菜。他们可以帮您送出订单，您也可以自己送出。",
    aloneTitle: "现在把这张订单送到厨房吗？",
    aloneHelp: "用餐后到柜台付款。",
    yesSend: "好，送出",
    notYet: "还没",
    switchToNormal: "普通菜单",
    switchToEasy: "大图菜单",
    table: (c) => `${c} 号桌`,
    menu: "菜单",
    add: "加入",
    tableOrder: "本桌点的菜",
    emptyCart: "还没有点菜。本桌每部手机点的菜都会出现在这里。",
    nothingNew: "上次下单后没有新的菜。",
    nothingToSend: "还没有可送出的菜",
    itemsFrom: (n, p) => `${p} 人共 ${n} 份`,
    send: "送到厨房",
    sending: "正在送出",
    sent: "已送到厨房",
    payAfter: "用餐后到柜台付款。",
    yourName: "您的名字",
    all: "全部",
    recording: "正在听。说完请按一下。",
    voiceFailed: "听不清楚。请再说一次，或者打字。",
    aiFallback: "语音AI忙碌中。请再说一次，这部手机会听。",
    sayAgain: "再说一次",
    chooseAnother: "看图片选择",
    didYouMean: "您是不是要这些？",
    allDishes: "全部菜",
    tapToAdd: "请按您要的菜。",
    addThese: "这是您要点的吗？",
    soldOut: "卖完了",
    soldOutIs: (d) => `不好意思，${d} 今天卖完了。`,
    tryInstead: "要不要试试这些？",
    backToChoice: "换菜单",
    menuChoice: "菜单样式",
    guest: "客人",
    byVoice: "语音点餐",
    speak: "说出您要点的",
    speakShort: "语音点餐",
    listening: "正在听，请说。",
    stopListening: "我说完了",
    heard: "我听到",
    isThisRight: "对吗？",
    yesAdd: "对，加入",
    tryAgain: "不对，再说一次",
    cancel: "取消",
    notFound: "菜单上没有这道菜。请再说一次，或直接按菜的照片。",
    noMic: "这部手机不能听语音，请打字。",
    typeInstead: "或者打字点餐",
    typePlaceholder: "两杯拉茶少甜",
    find: "找菜",
    speechLang: "我要说",
    myPicks: "我点的",
    nothingYet: "还没有点菜。看到想吃的，请按绿色按钮。",
    seenAll: "您已经看完所有的菜",
    lookAgain: "再看一次菜单",
    dishOf: (n, t) => `第 ${n} 道，共 ${t} 道`,
    orderSent: "订单已送到厨房",
    stages: ["已收到订单", "准备中", "烹煮中", "可以上菜了"],
    orderMore: "再点一些",
    remove: "减一份",
    oneMore: "再加一份",
    close: "关闭",
    loading: "正在打开菜单",
    changeName: "更改名字",
  },
};

/** Shown before a language is chosen, so each line carries all three. */
export const CHOOSER = {
  question: ["How do you want to order?", "Bagaimana anda mahu pesan?", "您想怎样点餐？"],
  easy: ["Big Photos Menu", "Menu Gambar Besar", "大图菜单"],
  normal: ["Normal Menu", "Menu Biasa", "普通菜单"],
} as const;
