import type { Lang, MenuItem } from "./types";

/** Shown as the header of both menus. In FeedMe this comes from the restaurant's profile. */
export const RESTAURANT_NAME = "Kopitiam Sedap";

/** Category tabs of the Normal Menu, in display order. */
export const CATEGORIES: { id: string; label: Record<Lang, string> }[] = [
  { id: "rice", label: { en: "Rice", ms: "Nasi", zh: "饭类" } },
  { id: "noodles", label: { en: "Noodles", ms: "Mi", zh: "面类" } },
  { id: "drinks", label: { en: "Drinks", ms: "Minuman", zh: "饮料" } },
];

/**
 * Sample menu used when Supabase is not connected.
 * The same rows are seeded into the `menu_items` table by supabase/schema.sql.
 */
export const SAMPLE_MENU: MenuItem[] = [
  {
    id: "nasi-lemak",
    category: "rice",
    kind: "food",
    name: { en: "Nasi Lemak", ms: "Nasi Lemak", zh: "椰浆饭" },
    desc: {
      en: "Coconut rice, fried chicken, sambal, egg",
      ms: "Nasi santan, ayam goreng, sambal, telur",
      zh: "椰浆饭、炸鸡、参巴辣椒、鸡蛋",
    },
    price: 8.9,
    image: "/menu/nasi-lemak.png",
    inStock: true,
    aliases: ["nasi lemak deluxe", "nasi lemak", "nasilemak", "椰浆饭", "椰漿飯", "நாசி லெமாக்", "nasi lemak biasa", "lemak", "椰浆饭", "ye jiang fan", "香饭"],
  },
  {
    id: "chicken-rice",
    category: "rice",
    kind: "food",
    name: { en: "Chicken Rice", ms: "Nasi Ayam", zh: "鸡饭" },
    desc: {
      en: "Poached chicken, fragrant rice, chilli sauce",
      ms: "Ayam rebus, nasi wangi, sos cili",
      zh: "白斩鸡、油饭、辣椒酱",
    },
    price: 6.5,
    image: "/menu/chicken-rice.png",
    inStock: true,
    aliases: ["chicken rice", "nasi ayam", "海南鸡饭", "鸡饭", "雞飯", "ji fan", "kai fan", "koi png", "kai png", "சிக்கன் ரைஸ்", "钖饭", "白鸡饭", "ji png", "kai pui", "ayam rice", "chicken ice"],
  },
  {
    id: "laksa",
    category: "noodles",
    kind: "food",
    name: { en: "Laksa", ms: "Laksa", zh: "叻沙" },
    desc: {
      en: "Spiced coconut noodle soup with prawns",
      ms: "Mi kuah santan berempah dengan udang",
      zh: "香辣椰浆汤面，配鲜虾",
    },
    price: 7.2,
    image: "/menu/laksa.png",
    inStock: true,
    aliases: ["laksa", "叻沙", "喇沙", "拉沙", "辣沙", "லக்சா", "curry laksa", "lasak", "laksar", "咖喱面"],
  },
  {
    id: "teh-tarik",
    category: "drinks",
    kind: "drink",
    name: { en: "Teh Tarik", ms: "Teh Tarik", zh: "拉茶" },
    desc: {
      en: "Hand-pulled milk tea, served hot",
      ms: "Teh susu tarik, dihidang panas",
      zh: "手拉奶茶，热饮",
    },
    price: 2.5,
    image: "/menu/teh-tarik.png",
    inStock: true,
    aliases: ["teh tarik", "pulled tea", "milk tea", "拉茶", "奶茶", "தே தாரிக்", "teh", "tea", "teh tarik panas", "teh peng", "teh ping", "teh ais", "teh o", "拉茶", "奶茶冰", "tea tarik", "the tarik"],
  },
];

export function formatRM(amount: number): string {
  return `RM ${amount.toFixed(2)}`;
}
