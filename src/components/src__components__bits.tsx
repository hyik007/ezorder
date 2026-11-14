import Image from "next/image";
import type { MenuItem } from "@/lib/types";

/**
 * A dish photo. "contain" shows the whole plate (the big menu); "cover" fills a small tile.
 * Works for bundled images and Supabase Storage URLs.
 */
export function DishPhoto({
  item,
  alt,
  sizes,
  priority,
  fit = "cover",
}: {
  item: MenuItem;
  alt: string;
  sizes: string;
  priority?: boolean;
  fit?: "cover" | "contain";
}) {
  return (
    <Image
      src={item.image}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      unoptimized={!item.image.startsWith("/")}
      className={fit === "contain" ? "object-contain" : "object-cover"}
    />
  );
}

/** Kitchen progress. `stage` is 0-3; everything before it is done. */
export function Stages({
  labels,
  stage,
  ready,
  large,
}: {
  labels: readonly string[];
  stage: number;
  ready: boolean;
  large?: boolean;
}) {
  return (
    <ol className={`flex flex-col ${large ? "gap-4" : "gap-2.5"}`}>
      {labels.map((label, i) => {
        const done = ready || i < stage;
        const active = !ready && i === stage;
        return (
          <li key={label} className="flex items-center gap-4" aria-current={active ? "step" : undefined}>
            <span
              className={`flex shrink-0 items-center justify-center rounded-full font-bold ${
                large ? "h-12 w-12 text-2xl" : "h-8 w-8 text-base"
              } ${
                done
                  ? "bg-success text-white"
                  : active
                    ? "bg-primary text-ink"
                    : "border-2 border-rule bg-porcelain text-soft"
              }`}
            >
              {done ? "✓" : i + 1}
            </span>
            <span
              className={`${large ? "text-2xl" : "text-lg"} ${
                done || active ? "font-bold text-ink" : "text-soft"
              }`}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function CenterMessage({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center p-8 text-center">
      <p className="max-w-sm text-2xl font-bold leading-snug">{children}</p>
    </main>
  );
}
