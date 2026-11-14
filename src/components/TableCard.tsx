"use client";

import { QRCodeSVG } from "qrcode.react";
import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** The printed card that sits on a restaurant table. One QR code; the phone offers both menus. */
export function TableCard({ table, size = 150 }: { table: string; size?: number }) {
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => "");
  return (
    <div className="flex w-56 flex-col items-center gap-2 rounded-2xl border-2 border-ink bg-white p-4 text-center text-ink">
      <p className="text-lg font-bold leading-none text-primary">EZorder</p>
      <p className="text-4xl font-bold leading-none">Table {table}</p>
      <div style={{ width: size, height: size }}>
        {origin && <QRCodeSVG value={`${origin}/t/${table}`} size={size} fgColor="#0f2a20" level="M" />}
      </div>
      <p className="font-bold leading-snug">
        Scan to order
        <br />
        Imbas untuk pesan
        <br />
        <span lang="zh">扫码点餐</span>
      </p>
    </div>
  );
}
