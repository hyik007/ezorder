"use client";

import { useEffect, useState } from "react";
import { store } from "./store";
import type { MenuItem, TableState } from "./types";

export type TableView =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; table: TableState; menu: MenuItem[]; myId: string };

/** Live view of one table: menu, shared cart, and the latest order. */
export function useTable(table: string): TableView {
  const [view, setView] = useState<TableView>({ status: "loading" });

  useEffect(() => {
    let active = true;
    let menu: MenuItem[] | null = null;
    let myId: string | null = null;
    let latest: TableState | null = null;

    const publish = () => {
      if (active && latest && menu && myId) setView({ status: "ready", table: latest, menu, myId });
    };
    const fail = (message: string) => {
      if (active) setView({ status: "error", message });
    };

    store
      .whoAmI()
      .then((id) => {
        myId = id;
        publish();
      })
      .catch((e: Error) => fail(e.message));

    const stopMenu = store.subscribeMenu((m) => {
      menu = m;
      publish();
    }, fail);

    const stop = store.subscribe(
      table,
      (state) => {
        latest = state;
        publish();
      },
      fail,
    );
    return () => {
      active = false;
      stop();
      stopMenu();
    };
  }, [table]);

  return view;
}

/** Ticks once a second; used to show kitchen progress from the order's timestamp. */
export function useNow(enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [enabled]);
  return now;
}

const STAGE_SECONDS = 6;

/** Demo kitchen: every phone works out the same stage from when the order was sent. */
export function kitchenStage(orderCreatedAt: string, now: number): { stage: number; ready: boolean } {
  const elapsed = Math.max(0, (now - new Date(orderCreatedAt).getTime()) / 1000);
  const stage = Math.min(3, Math.floor(elapsed / STAGE_SECONDS));
  return { stage, ready: stage === 3 };
}
