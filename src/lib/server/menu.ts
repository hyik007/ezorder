import { SAMPLE_MENU } from "../menu";
import type { MenuItem } from "../types";

/**
 * The menu as the server sees it, sold-out dishes included (voice needs to know what has run out).
 * Voice ordering always matches against this, never against a menu sent by the phone,
 * so a phone cannot invent dishes, prices or stock.
 * Reads Supabase when it is configured (the menu is public), otherwise the sample menu.
 */
type Row = {
  id: string;
  kind: "food" | "drink";
  category: string;
  name_en: string;
  name_ms: string;
  name_zh: string;
  desc_en: string;
  desc_ms: string;
  desc_zh: string;
  price: number | string;
  image_url: string;
  aliases: string[] | null;
  available: boolean;
};

let cache: { at: number; menu: MenuItem[] } | null = null;
const TTL_MS = 60_000;

export async function serverMenu(): Promise<MenuItem[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return SAMPLE_MENU;
  if (cache && Date.now() - cache.at < TTL_MS) return cache.menu;
  try {
    const res = await fetch(`${url}/rest/v1/menu_items?select=*&order=sort`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`menu ${res.status}`);
    const rows = (await res.json()) as Row[];
    const menu = rows.map(
      (r): MenuItem => ({
        id: r.id,
        kind: r.kind,
        category: r.category,
        name: { en: r.name_en, ms: r.name_ms, zh: r.name_zh },
        desc: { en: r.desc_en, ms: r.desc_ms, zh: r.desc_zh },
        price: Number(r.price),
        image: r.image_url,
        aliases: r.aliases ?? [],
        inStock: r.available,
      }),
    );
    cache = { at: Date.now(), menu };
    return menu;
  } catch {
    return cache?.menu ?? SAMPLE_MENU;
  }
}
