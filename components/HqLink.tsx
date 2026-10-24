// Small "Brainerd HQ" link for the right side of every header — every other Brainerd
// dashboard has the same link, so people can always get back to the HQ home.
export function HqLink() {
  return (
    <a href="https://brainerdhq.app" className="hidden whitespace-nowrap text-xs text-muted transition-colors hover:text-brand-soft sm:inline">
      Brainerd HQ
    </a>
  );
}
