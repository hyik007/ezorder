import { LANG_LABEL } from "@/lib/i18n";
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
          className={`min-h-11 rounded-lg px-2.5 text-lg font-bold ${lang === l ? "bg-ink text-white" : "text-ink"}`}
        >
          {LANG_LABEL[l]}
        </button>
      ))}
    </div>
  );
}
