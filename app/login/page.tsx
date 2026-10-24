"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

const MESSAGES: Record<string, string> = {
  denied: "That account doesn't have access to Brainerd Mail yet.",
  failed: "Sign-in didn't finish. Please try again.",
  missing: "Sign-in didn't finish. Please try again.",
};

export default function Login({ searchParams }: { searchParams: { error?: string } }) {
  const [busy, setBusy] = useState(false);
  const msg = searchParams.error ? MESSAGES[searchParams.error] ?? MESSAGES.failed : "";
  async function go() {
    setBusy(true);
    const base = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    await supabaseBrowser().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${base}/auth/callback`, queryParams: { hd: "brainerdbaptist.org", prompt: "select_account" } },
    });
  }
  return (
    <main className="min-h-dvh flex items-center justify-center px-4" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="w-full max-w-sm">
        <div className="mb-10 flex flex-col items-center text-center">
          <img className="brand-logo-light mb-3" src="/brand/brainerd-full.png" alt="Brainerd Baptist Church" width={200} height={47} style={{ height: "auto", width: 200 }} />
          <img className="brand-logo-dark mb-3" src="/brand/brainerd-full-white.png" alt="Brainerd Baptist Church" width={200} height={47} style={{ height: "auto", width: 200 }} />
          <p className="text-xs uppercase tracking-[0.3em] text-muted">Mail</p>
        </div>
        <div className="space-y-5 rounded-lg border border-brand/20 bg-surface p-8 shadow-lg">
          <p className="text-center text-[15px] text-muted">Sign in with your church Google account.</p>
          {msg && <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">{msg}</p>}
          <button onClick={go} disabled={busy} className="w-full rounded-full bg-brand py-2.5 font-semibold text-white disabled:opacity-60" style={{ boxShadow: "0 0 0 1px rgb(var(--color-brand) / 0.18), 0 4px 16px rgb(var(--color-brand) / 0.28)" }}>
            {busy ? "Opening Google…" : "Continue with Google"}
          </button>
        </div>
      </div>
    </main>
  );
}
