import { LANG_LABEL } from "@/lib/i18n";

/**
 * Short forms when the header is narrow, where three full names crowd out the restaurant name.
 * Decided by the header's own width (container query), so a phone-width column on an iPad
 * gets the short form too.
 */
const SHORT: Record<Lang, string> = { en: "EN", ms: "BM", zh: "中文" };
import type { Lang } from "@/lib/types";

const LANGS: Lang[] = ["en", "ms", "zh"];

export function LangPicker({ lang, onPick }: { lang: Lang; onPick: (l: Lang) => void }) {
  return (
    <div className="flex shrink-0 gap-1 rounded-xl bg-porcelain p-1" role="group" aria-label="Language">
      {LANGS.map((l) => (
        <button
          key={l}
          onClick={() => onPick(l)}
          aria-pressed={lang === l}
          lang={l}
          aria-label={LANG_LABEL[l]}
          className={`min-h-11 min-w-11 rounded-lg px-2 text-lg font-bold whitespace-nowrap short:min-h-10 ${
            lang === l ? "bg-ink text-white" : "text-ink"
          }`}
        >
          <span className="@lg:hidden">{SHORT[l]}</span>
          <span className="hidden @lg:inline">{LANG_LABEL[l]}</span>
        </button>
      ))}
    </div>
  );
}
