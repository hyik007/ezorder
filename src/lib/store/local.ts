import { SAMPLE_MENU } from "../menu";
import type { MenuItem, TableState } from "../types";
import { IDLE_HOURS, sameNotes, type Store } from "./types";

/**
 * Local mode: tables live in this browser's localStorage and sync between tabs
 * (and the two phones on /demo) through a BroadcastChannel. No account, no network.
 */

const PREFIX = "ezorder:table:";
const SOLD_OUT_KEY = "ezorder:sold-out";
const CHANNEL = "ezorder";

/** Ids the staff page has marked sold out in this browser. */
function soldOut(): string[] {
  try {
    const raw = localStorage.getItem(SOLD_OUT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function menuNow(): MenuItem[] {
  const out = new Set(soldOut());
  return SAMPLE_MENU.map((m) => ({ ...m, inStock: !out.has(m.id) }));
}

function read(table: string): TableState | null {
  try {
    const raw = localStorage.getItem(PREFIX + table);
    return raw ? (JSON.parse(raw) as TableState) : null;
  } catch {
    return null;
  }
}

const listeners = new Map<string, Set<() => void>>();
let channel: BroadcastChannel | null = null;

function wake(table: string) {
  listeners.get(table)?.forEach((fn) => fn());
}

function ensureChannel() {
  if (channel || typeof BroadcastChannel === "undefined") return;
  channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (e) => wake(String(e.data));
  window.addEventListener("storage", (e) => {
    if (e.key === SOLD_OUT_KEY) wake(SOLD_OUT_KEY);
    else if (e.key?.startsWith(PREFIX)) wake(e.key.slice(PREFIX.length));
  });
}

function write(state: TableState) {
  localStorage.setItem(PREFIX + state.session.table, JSON.stringify(state));
  ensureChannel();
  channel?.postMessage(state.session.table);
  wake(state.session.table);
}

function uid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function fresh(table: string): TableState {
  return {
    session: { id: uid(), table, createdAt: new Date().toISOString() },
    lines: [],
    order: null,
  };
}

function lastActivity(state: TableState): number {
  const times = [state.session.createdAt, state.order?.createdAt, ...state.lines.map((l) => l.createdAt)];
  return Math.max(...times.filter(Boolean).map((t) => new Date(t!).getTime()));
}

/** The table's current sitting. Starts a new one if there is none or the old one went idle. */
function current(table: string): TableState {
  const state = read(table);
  if (state && Date.now() - lastActivity(state) < IDLE_HOURS * 3600_000) return state;
  const next = fresh(table);
  localStorage.setItem(PREFIX + table, JSON.stringify(next));
  return next;
}

export const localStore: Store = {
  mode: "local",

  async whoAmI() {
    let id = localStorage.getItem("ezorder:device");
    if (!id) {
      id = uid();
      localStorage.setItem("ezorder:device", id);
    }
    return id;
  },

  subscribeMenu(onMenu) {
    ensureChannel();
    const fn = () => onMenu(menuNow());
    if (!listeners.has(SOLD_OUT_KEY)) listeners.set(SOLD_OUT_KEY, new Set());
    listeners.get(SOLD_OUT_KEY)!.add(fn);
    queueMicrotask(fn);
    return () => {
      listeners.get(SOLD_OUT_KEY)?.delete(fn);
    };
  },

  async setStock(itemId, inStock) {
    const next = inStock ? soldOut().filter((id) => id !== itemId) : [...new Set([...soldOut(), itemId])];
    localStorage.setItem(SOLD_OUT_KEY, JSON.stringify(next));
    ensureChannel();
    channel?.postMessage(SOLD_OUT_KEY);
    wake(SOLD_OUT_KEY);
  },

  subscribe(table, onState) {
    ensureChannel();
    const fn = () => onState(current(table));
    if (!listeners.has(table)) listeners.set(table, new Set());
    listeners.get(table)!.add(fn);
    queueMicrotask(fn);
    return () => {
      listeners.get(table)?.delete(fn);
    };
  },

  async addLine(table, who, line) {
    const state = current(table);
    const existing = state.lines.find(
      (l) =>
        l.orderId === null &&
        l.qty > 0 &&
        l.itemId === line.itemId &&
        l.addedBy === who.id &&
        l.addedByName === who.name &&
        sameNotes(l.notes, line.notes),
    );
    if (existing) {
      existing.qty = Math.min(20, existing.qty + line.qty);
    } else {
      state.lines.push({
        id: uid(),
        itemId: line.itemId,
        qty: line.qty,
        notes: line.notes,
        addedBy: who.id,
        addedByName: who.name,
        source: line.source,
        via: line.via,
        orderId: null,
        createdAt: new Date().toISOString(),
      });
    }
    write(state);
  },

  async setQty(table, lineId, qty) {
    const state = current(table);
    const line = state.lines.find((l) => l.id === lineId);
    if (!line || line.orderId !== null) return;
    line.qty = Math.max(0, Math.min(20, qty));
    write(state);
  },

  async confirmOrder(table) {
    const state = current(table);
    const open = state.lines.filter((l) => l.orderId === null && l.qty > 0);
    if (open.length === 0) throw new Error("There is nothing to send yet");
    const total = open.reduce(
      (sum, l) => sum + l.qty * (SAMPLE_MENU.find((m) => m.id === l.itemId)?.price ?? 0),
      0,
    );
    const order = { id: uid(), total, createdAt: new Date().toISOString() };
    for (const l of open) l.orderId = order.id;
    state.order = order;
    write(state);
  },

  async clearTable(table) {
    write(fresh(table));
  },
};
