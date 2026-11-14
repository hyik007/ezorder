import type { MenuItem, NewLine, Person, TableState } from "../types";

/**
 * Everything the screens need from a backend.
 * Two implementations: `local` (this browser only) and `supabase` (real sync between phones).
 *
 * A table is identified by the code printed on its QR card. Scanning the card joins the
 * table's current sitting, or quietly starts a new one if the table was cleared or left idle.
 */
export interface Store {
  mode: "local" | "supabase";
  /** A stable id for this browser. In Supabase mode it is the anonymous user id. */
  whoAmI(): Promise<string>;
  /**
   * The menu, now and on every change. Sold-out marks arrive here too, so a dish
   * running out updates every phone at the table without a reload.
   */
  subscribeMenu(onMenu: (menu: MenuItem[]) => void, onError: (message: string) => void): () => void;
  /** Staff: mark a dish sold out, or back on. */
  setStock(itemId: string, inStock: boolean): Promise<void>;
  /** Calls onState now and again on every change at this table. */
  subscribe(
    table: string,
    onState: (state: TableState) => void,
    onError: (message: string) => void,
  ): () => void;
  addLine(table: string, who: Person, line: NewLine): Promise<void>;
  setQty(table: string, lineId: string, qty: number): Promise<void>;
  /** Turn the table's open picks into one order for the kitchen. */
  confirmOrder(table: string): Promise<void>;
  /** Staff: end the current sitting so the next guests start with an empty table. */
  clearTable(table: string): Promise<void>;
}

/** A sitting left untouched this long is treated as finished when the next guest scans. */
export const IDLE_HOURS = 3;

export function sameNotes(a: string[], b: string[]): boolean {
  return a.length === b.length && [...a].sort().join() === [...b].sort().join();
}
