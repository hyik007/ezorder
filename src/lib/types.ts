export type Lang = "en" | "ms" | "zh";

export type MenuItem = {
  id: string;
  kind: "food" | "drink";
  /** Category tab this dish sits under in the Normal Menu (see CATEGORIES in menu.ts). */
  category: string;
  name: Record<Lang, string>;
  desc: Record<Lang, string>;
  price: number;
  image: string;
  /** Words people actually say for this dish, in any language. Used by voice ordering. */
  aliases: string[];
  /** False when the kitchen has run out. Sold-out dishes stay on the menu, clearly marked. */
  inStock: boolean;
};

/** Things a diner can ask for. Stored as keys so every phone shows them in its own language. */
export type NoteKey = "less-sweet" | "no-sugar" | "not-spicy" | "iced" | "hot" | "takeaway";

export type Line = {
  id: string;
  itemId: string;
  qty: number;
  notes: NoteKey[];
  addedBy: string;
  addedByName: string;
  source: "tap" | "voice";
  /** Which of the two menus the pick came from. Lets the restaurant see how much the Big Photos Menu is used. */
  via: MenuMode;
  /** null while the line is still in the shared cart; set once the order is sent to the kitchen. */
  orderId: string | null;
  createdAt: string;
};

export type Order = {
  id: string;
  total: number;
  createdAt: string;
};

/** One sitting at a physical table. A new one starts when the table is cleared or left idle. */
export type Session = {
  id: string;
  table: string;
  createdAt: string;
};

export type TableState = {
  session: Session;
  lines: Line[];
  /** Most recent order sent to the kitchen in this sitting, if any. */
  order: Order | null;
};

export type Person = { id: string; name: string };

export type NewLine = {
  itemId: string;
  qty: number;
  notes: NoteKey[];
  source: "tap" | "voice";
  via: MenuMode;
};

/** The two menus behind the single table QR code. */
export type MenuMode = "easy" | "normal";

/** Table codes are what is printed on the QR card: "5", "12", "A3". */
export function cleanTableCode(raw: string): string | null {
  const code = decodeURIComponent(raw).trim().toUpperCase();
  return /^[A-Z0-9]{1,4}$/.test(code) ? code : null;
}
