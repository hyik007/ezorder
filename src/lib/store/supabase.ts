import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Line, MenuItem, NoteKey, Order, Session, TableState } from "../types";
import { sameNotes, type Store } from "./types";

/**
 * Supabase mode: real sync between phones.
 *   Database  -> menu_items, table_sessions, cart_items, orders   (supabase/schema.sql)
 *   Functions -> join_table, confirm_order, clear_table run inside the database
 *   Auth      -> anonymous sign-in, so nobody types a password
 *   Realtime  -> every phone at the table hears cart and order changes
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
// New projects call it a "publishable" key (sb_publishable_...). Older ones call it the "anon" key.
const publicKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && publicKey);

let client: SupabaseClient | null = null;
function db(): SupabaseClient {
  if (!client) client = createClient(url!, publicKey!);
  return client;
}

let signingIn: Promise<string> | null = null;
/** Sign in anonymously once per browser and reuse that identity. */
function ensureUser(): Promise<string> {
  if (!signingIn) {
    signingIn = (async () => {
      const { data } = await db().auth.getSession();
      if (data.session) return data.session.user.id;
      const { data: fresh, error } = await db().auth.signInAnonymously();
      if (error || !fresh.user) {
        signingIn = null;
        throw new Error(
          "Could not sign in. In Supabase, turn on Authentication > Sign In / Providers > Allow anonymous sign-ins.",
        );
      }
      return fresh.user.id;
    })();
  }
  return signingIn;
}

type MenuRow = {
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
type SessionRow = { id: string; table_code: string; created_at: string };
type LineRow = {
  id: string;
  item_id: string;
  qty: number;
  notes: string[] | null;
  added_by: string;
  added_by_name: string;
  source: "tap" | "voice";
  via: "easy" | "normal";
  order_id: string | null;
  created_at: string;
};
type OrderRow = { id: string; total: number | string; created_at: string };

const toMenuItem = (r: MenuRow): MenuItem => ({
  id: r.id,
  kind: r.kind,
  category: r.category,
  name: { en: r.name_en, ms: r.name_ms, zh: r.name_zh },
  desc: { en: r.desc_en, ms: r.desc_ms, zh: r.desc_zh },
  price: Number(r.price),
  image: r.image_url,
  aliases: r.aliases ?? [],
  inStock: r.available,
});

const toSession = (r: SessionRow): Session => ({ id: r.id, table: r.table_code, createdAt: r.created_at });
const toLine = (r: LineRow): Line => ({
  id: r.id,
  itemId: r.item_id,
  qty: r.qty,
  notes: (r.notes ?? []) as NoteKey[],
  addedBy: r.added_by,
  addedByName: r.added_by_name,
  source: r.source,
  via: r.via,
  orderId: r.order_id,
  createdAt: r.created_at,
});
const toOrder = (r: OrderRow): Order => ({ id: r.id, total: Number(r.total), createdAt: r.created_at });

/** Join the table's current sitting (the database starts a new one if needed). */
async function joinTable(table: string): Promise<Session> {
  await ensureUser();
  const { data, error } = await db().rpc("join_table", { p_table: table });
  if (error || !data) throw new Error(error?.message ?? "Could not open the table");
  return toSession(data as SessionRow);
}

async function fetchState(table: string): Promise<TableState> {
  const session = await joinTable(table);
  const [lines, order] = await Promise.all([
    db().from("cart_items").select("*").eq("session_id", session.id).order("created_at"),
    db()
      .from("orders")
      .select("*")
      .eq("session_id", session.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const failed = lines.error ?? order.error;
  if (failed) throw new Error(failed.message);
  return {
    session,
    lines: ((lines.data ?? []) as LineRow[]).map(toLine),
    order: order.data ? toOrder(order.data as OrderRow) : null,
  };
}

export const supabaseStore: Store = {
  mode: "supabase",

  whoAmI: ensureUser,

  subscribeMenu(onMenu, onError) {
    let stopped = false;

    const refresh = async () => {
      try {
        await ensureUser();
        // Sold-out dishes are still fetched: they stay on the menu, clearly marked.
        const { data, error } = await db().from("menu_items").select("*").order("sort");
        if (error) throw new Error(error.message);
        if (!stopped) onMenu(((data ?? []) as MenuRow[]).map(toMenuItem));
      } catch (e) {
        if (!stopped) onError(e instanceof Error ? e.message : "Could not load the menu");
      }
    };

    const channel = db()
      .channel("menu")
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, refresh);
    void ensureUser()
      .then(() => {
        if (!stopped) channel.subscribe();
      })
      .catch(() => {});
    void refresh();

    return () => {
      stopped = true;
      void db().removeChannel(channel);
    };
  },

  async setStock(itemId, inStock) {
    await ensureUser();
    const { error } = await db().rpc("set_item_stock", { p_item: itemId, p_in_stock: inStock });
    if (error) throw new Error(error.message);
  },

  subscribe(table, onState, onError) {
    let stopped = false;
    let running = false;
    let again = false;

    const refresh = async () => {
      if (stopped) return;
      if (running) {
        again = true;
        return;
      }
      running = true;
      try {
        const state = await fetchState(table);
        if (!stopped) onState(state);
      } catch (e) {
        if (!stopped) onError(e instanceof Error ? e.message : "Could not load the table");
      } finally {
        running = false;
        if (again) {
          again = false;
          void refresh();
        }
      }
    };

    // Realtime: any change at this table (picks, orders, table cleared) triggers a fresh read.
    const filter = `table_code=eq.${table}`;
    const channel = db()
      .channel(`table-${table}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "cart_items", filter }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "table_sessions", filter }, refresh);

    void ensureUser()
      .then(() => {
        if (!stopped) channel.subscribe();
      })
      .catch((e: Error) => onError(e.message));
    void refresh();

    // Safety net for phones that fall asleep or drop off restaurant Wi-Fi.
    const poll = setInterval(refresh, 5000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stopped = true;
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      void db().removeChannel(channel);
    };
  },

  async addLine(table, who, line) {
    const session = await joinTable(table);
    // Same person, same dish, same requests -> bump the quantity instead of adding a second row.
    const { data: open, error: readError } = await db()
      .from("cart_items")
      .select("*")
      .eq("session_id", session.id)
      .eq("item_id", line.itemId)
      .eq("added_by", who.id)
      .eq("added_by_name", who.name)
      .is("order_id", null)
      .gt("qty", 0);
    if (readError) throw new Error(readError.message);
    const existing = ((open ?? []) as LineRow[]).find((r) => sameNotes(r.notes ?? [], line.notes));
    const { error } = existing
      ? await db()
          .from("cart_items")
          .update({ qty: Math.min(20, existing.qty + line.qty) })
          .eq("id", existing.id)
      : await db().from("cart_items").insert({
          session_id: session.id,
          table_code: table,
          item_id: line.itemId,
          qty: line.qty,
          notes: line.notes,
          added_by_name: who.name,
          source: line.source,
          via: line.via,
        });
    if (error) throw new Error(error.message);
  },

  async setQty(_table, lineId, qty) {
    await ensureUser();
    const { error } = await db()
      .from("cart_items")
      .update({ qty: Math.max(0, Math.min(20, qty)) })
      .eq("id", lineId);
    if (error) throw new Error(error.message);
  },

  async confirmOrder(table) {
    await ensureUser();
    // One database function does the whole thing, so two taps can never create two orders.
    const { error } = await db().rpc("confirm_order", { p_table: table });
    if (error) throw new Error(error.message);
  },

  async clearTable(table) {
    await ensureUser();
    const { error } = await db().rpc("clear_table", { p_table: table });
    if (error) throw new Error(error.message);
  },
};

/**
 * Remember whether the diner said "Yes" or "No" to what was understood.
 * This is the raw material for teaching each restaurant's slang to the matcher.
 */
export function logVoiceFeedback(entry: {
  table: string;
  heard: string;
  proposed: { itemId: string; qty: number }[];
  /** What the diner finally added, if they corrected the proposal. */
  chosen?: { itemId: string; qty: number }[];
  accepted: boolean;
  engine: string;
}): void {
  if (!supabaseConfigured) return;
  void ensureUser()
    .then(() =>
      db().from("voice_feedback").insert({
        table_code: entry.table,
        heard: entry.heard.slice(0, 300),
        proposed: entry.proposed,
        chosen: entry.chosen ?? null,
        accepted: entry.accepted,
        engine: entry.engine,
      }),
    )
    .catch(() => {});
}
