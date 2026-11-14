import { RESTAURANT_NAME } from "@/lib/menu";

/**
 * The orange FeedMe-style header: which restaurant, which table, and a way back.
 * `onBack` returns to the menu chooser, so nobody is trapped in a menu they did not want.
 */
export function AppBar({
  tableLabel,
  backLabel,
  onBack,
  children,
}: {
  tableLabel: string;
  backLabel?: string;
  onBack?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <header className="@container -mx-4 -mt-4 flex shrink-0 items-center gap-2 bg-primary px-3 pb-3 pt-[calc(0.75rem+var(--safe-top))] text-ink short:pb-2 short:pt-[calc(0.5rem+var(--safe-top))]">
      {onBack && (
        <button
          onClick={onBack}
          aria-label={backLabel}
          className="flex min-h-12 shrink-0 items-center gap-1 rounded-xl border-2 border-ink px-2 font-bold short:min-h-11"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          <span className="hidden text-base @2xl:inline">{backLabel}</span>
        </button>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-extrabold leading-tight short:text-base">{RESTAURANT_NAME}</p>
        <p className="truncate text-lg font-semibold leading-tight short:text-base">{tableLabel}</p>
      </div>
      {children}
    </header>
  );
}
