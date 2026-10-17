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
    <main className="min-h-dvh grid place-items-center px-4 bg-slate-100" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
        <img src="/brand/brainerd-logo.png" alt="Brainerd Baptist Church" width={200} height={30} className="mx-auto h-auto w-[200px]" />
        <div className="mt-2 text-[15px] font-bold tracking-[0.3em] text-[#00205b]">MAIL</div>
        <p className="mt-3 text-[15px] text-slate-600">Sign in with your church Google account.</p>
        {msg && <p className="mt-4 rounded-lg bg-red-50 text-red-800 text-sm px-3 py-2">{msg}</p>}
        <button onClick={go} disabled={busy} className="mt-6 w-full h-12 rounded-full bg-[#1e61b9] text-white font-semibold text-base disabled:opacity-60">
          {busy ? "Opening Google…" : "Continue with Google"}
        </button>
      </div>
    </main>
  );
}
