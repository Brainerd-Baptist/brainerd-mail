// The "who am I looking at" mark that sits at the left of every Brainerd header: logo, a thin
// divider, then the page name in small gray capitals. Same recipe as Personnel, HQ and the
// workspaces (32px logo; 1px x 24px divider in the accent at 20%; 12px uppercase text, 0.2em
// tracking, muted gray, system font, one line, hidden on phones where space is tight).
const SYSTEM_UI_FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const HEIGHT = 32;

export function HeaderBrand({ label = "Mail" }: { label?: string }) {
  return (
    <div className="flex shrink-0 items-center gap-3">
      <span className="inline-flex shrink-0 items-center" style={{ transform: `translateY(${Math.round(HEIGHT * 0.1)}px)` }}>
        <img src="/brand/brainerd-full.png" alt="Brainerd Baptist Church" width={Math.round(HEIGHT * (560 / 131))} height={HEIGHT} style={{ height: HEIGHT, width: "auto" }} />
      </span>
      <div className="hidden items-center gap-3 sm:flex">
        <div className="h-6 w-px bg-brand/20" />
        <span className="whitespace-nowrap text-xs uppercase tracking-[0.2em] text-muted" style={{ fontFamily: SYSTEM_UI_FONT_STACK }}>{label}</span>
      </div>
    </div>
  );
}
