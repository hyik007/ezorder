import type { MenuItem, NoteKey } from "./types";

export type ParsedItem = { itemId: string; qty: number; notes: NoteKey[] };

/*
  Turning words into menu items. Pure functions with no browser or server dependencies:
  the phone uses them when there is no AI, and the server uses them as a safety net
  when the AI's answer is unusable.
*/

const QTY_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  satu: 1, se: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6,
  一: 1, 二: 2, 两: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6,
  // Hokkien / Cantonese as people romanise them, and Tamil (spoken forms and script)
  chit: 1, nng: 2, sa: 3, yat: 1, loeng: 2, saam: 3,
  onnu: 1, rendu: 2, moonu: 3, naalu: 4,
  ஒன்று: 1, ஒரு: 1, இரண்டு: 2, ரெண்டு: 2, மூன்று: 3, மூணு: 3, நான்கு: 4,
};

const LATIN_QTY =
  /(?:^|[^a-z])(a|an|one|two|three|four|five|six|satu|se|dua|tiga|empat|lima|enam|chit|nng|sa|yat|loeng|saam|onnu|rendu|moonu|naalu)(?=$|[^a-z])/g;
const CJK_QTY = /[一二两兩三四五六]/g;
const TAMIL_QTY = /ஒன்று|ஒரு|இரண்டு|ரெண்டு|மூன்று|மூணு|நான்கு/g;
const DIGIT_QTY = /\d+/g;

const NOTE_PATTERNS: { key: NoteKey; appliesTo: "drink" | "food" | "any"; re: RegExp }[] = [
  // "tapau" (Cantonese 打包) is said for the whole order, food or drink.
  { key: "takeaway", appliesTo: "any", re: /tapau|ta pau|tarpau|bungkus|take ?away|打包|da bao/ },
  { key: "less-sweet", appliesTo: "drink", re: /less sugar|less sweet|kurang manis|siew dai|siu dai|少甜|少糖/ },
  { key: "no-sugar", appliesTo: "drink", re: /no sugar|tanpa gula|kosong|无糖|無糖|不要糖/ },
  { key: "iced", appliesTo: "drink", re: /\biced?\b|\bais\b|\bpeng\b|\bping\b|\bbing\b|冰/ },
  { key: "hot", appliesTo: "drink", re: /\bhot\b|\bpanas\b|热|熱/ },
  { key: "not-spicy", appliesTo: "food", re: /no(t)? spicy|less spicy|no chil+i|tak pedas|tidak pedas|kurang pedas|不要辣|不辣|少辣/ },
];

/** Last quantity mentioned in a slice of text, or null. */
function lastQty(text: string): number | null {
  let best: { at: number; n: number } | null = null;
  const consider = (at: number, n: number) => {
    if (n >= 1 && n <= 20 && (!best || at > best.at)) best = { at, n };
  };
  for (const m of text.matchAll(LATIN_QTY)) consider(m.index + m[0].length, QTY_WORDS[m[1]]);
  for (const m of text.matchAll(CJK_QTY)) consider(m.index, QTY_WORDS[m[0]]);
  for (const m of text.matchAll(TAMIL_QTY)) consider(m.index, QTY_WORDS[m[0]]);
  for (const m of text.matchAll(DIGIT_QTY)) consider(m.index, parseInt(m[0], 10));
  return best ? (best as { at: number; n: number }).n : null;
}

/**
 * Find menu items in something a person said, in English, Malay or Chinese.
 * "two teh tarik less sweet and one laksa" -> teh-tarik x2 (less sweet), laksa x1
 */
export function parseOrder(spoken: string, menu: MenuItem[]): ParsedItem[] {
  const text = spoken.toLowerCase().replace(/\s+/g, " ").trim();
  if (!text) return [];

  // 1. Where is each dish mentioned? Longest names first so "teh tarik" beats "teh".
  type Hit = { item: MenuItem; start: number; end: number };
  const taken: boolean[] = new Array(text.length).fill(false);
  const hits: Hit[] = [];
  const candidates = menu
    .flatMap((item) => item.aliases.map((alias) => ({ item, alias: alias.toLowerCase() })))
    .sort((a, b) => b.alias.length - a.alias.length);

  for (const { item, alias } of candidates) {
    if (hits.some((h) => h.item.id === item.id)) continue;
    let from = 0;
    while (from <= text.length) {
      const at = text.indexOf(alias, from);
      if (at === -1) break;
      const end = at + alias.length;
      const isLatin = /^[a-z ]+$/.test(alias);
      const wholeWord =
        !isLatin ||
        ((at === 0 || !/[a-z]/.test(text[at - 1])) && (end === text.length || !/[a-z]/.test(text[end])));
      const free = !taken.slice(at, end).some(Boolean);
      if (wholeWord && free) {
        for (let i = at; i < end; i++) taken[i] = true;
        hits.push({ item, start: at, end });
        break;
      }
      from = at + 1;
    }
  }
  hits.sort((a, b) => a.start - b.start);

  // 2. How many of each? Look just before the dish ("dua laksa"), else just after ("laksa dua").
  const result: ParsedItem[] = [];
  let gapStart = 0;
  let gapUsed = false;
  hits.forEach((hit, i) => {
    const before = text.slice(gapStart, hit.start);
    const afterEnd = i + 1 < hits.length ? hits[i + 1].start : text.length;
    const after = text.slice(hit.end, afterEnd);
    let qty = gapUsed ? null : lastQty(before);
    let usedAfter = false;
    if (qty === null) {
      qty = lastQty(after);
      usedAfter = qty !== null;
    }
    result.push({ itemId: hit.item.id, qty: Math.min(qty ?? 1, 10), notes: [] });
    gapStart = hit.end;
    gapUsed = usedAfter;
  });

  // 3. Requests like "less sweet" go to drinks, "not spicy" goes to food.
  for (const { key, appliesTo, re } of NOTE_PATTERNS) {
    if (!re.test(text)) continue;
    const matching =
      appliesTo === "any" ? result : result.filter((r) => menu.find((m) => m.id === r.itemId)?.kind === appliesTo);
    for (const r of matching.length > 0 ? matching : result) {
      if (!r.notes.includes(key)) r.notes.push(key);
    }
  }
  return result;
}

/**
 * Dishes that look most like what was said, best first. Used for "Did you mean…?" when nothing
 * matched exactly: compares letter pairs (or single characters for Chinese and Tamil script)
 * against every name and alias, so "nasi lemk" or "teh tarek" still find their dish.
 */
export function suggestDishes(spoken: string, menu: MenuItem[], limit = 4): string[] {
  menu = menu.filter((m) => m.inStock);
  const text = spoken.toLowerCase().replace(/\s+/g, " ").trim();
  if (!text) return [];
  const grams = (s: string) => {
    const set = new Set<string>();
    const latin = s.replace(/[^a-z ]/g, "");
    for (let i = 0; i < latin.length - 1; i++) {
      const g = latin.slice(i, i + 2);
      if (!g.includes(" ")) set.add(g);
    }
    for (const ch of s.replace(/[a-z0-9\s.,!?]/g, "")) set.add(ch);
    return set;
  };
  const said = grams(text);
  if (said.size === 0) return [];
  const scored = menu.map((item) => {
    let best = 0;
    for (const name of [...item.aliases, ...Object.values(item.name)]) {
      const g = grams(name.toLowerCase());
      if (g.size === 0) continue;
      let shared = 0;
      for (const x of g) if (said.has(x)) shared++;
      best = Math.max(best, shared / g.size);
    }
    return { id: item.id, score: best };
  });
  return scored
    .filter((s) => s.score >= 0.45)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.id);
}

/**
 * Dishes to offer in place of one that has run out: same category first, then the same kind
 * of thing (a drink for a drink). Used by the server and by the phone's own matcher.
 */
export function replacementsFor(soldOutIds: string[], menu: MenuItem[], limit = 2): string[] {
  const out: string[] = [];
  for (const id of soldOutIds) {
    const gone = menu.find((m) => m.id === id);
    if (!gone) continue;
    const available = menu.filter((m) => m.inStock && m.id !== id);
    const sameCategory = available.filter((m) => m.category === gone.category);
    const pool = sameCategory.length > 0 ? sameCategory : available.filter((m) => m.kind === gone.kind);
    for (const m of (pool.length > 0 ? pool : available).slice(0, limit)) out.push(m.id);
  }
  return [...new Set(out)];
}
