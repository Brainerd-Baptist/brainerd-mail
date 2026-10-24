import { ExternalLink } from "lucide-react";

// Small "Brainerd HQ" link for the right side of every header — every other Brainerd
// dashboard has the same link, so people can always get back to the HQ home.
export function HqLink() {
  return (
    <a href="https://brainerdhq.app" className="hidden items-center gap-1 whitespace-nowrap text-xs text-muted transition-colors hover:text-brand-soft sm:flex">
      Brainerd HQ
      <ExternalLink size={11} />
    </a>
  );
}
