import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { siteUrl } from "@/lib/site";
import { GOOGLE_CLIENT_ID, sha256hex, COOKIE_NONCE, COOKIE_STATE, flowCookie } from "@/lib/google-signin";

// Starts Google sign-in. If direct sign-in isn't configured, falls back to the old button's path.
export async function GET() {
  const base = siteUrl();
  const clientId = GOOGLE_CLIENT_ID();
  if (!clientId) return NextResponse.redirect(`${base}/login?error=failed`);
  const nonce = randomBytes(24).toString("hex");
  const state = randomBytes(24).toString("hex");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", `${base}/auth/google/callback`);
  url.searchParams.set("response_type", "id_token");
  url.searchParams.set("response_mode", "form_post");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("nonce", sha256hex(nonce));
  url.searchParams.set("state", state);
  url.searchParams.set("hd", "brainerdbaptist.org");
  url.searchParams.set("prompt", "select_account");
  const res = NextResponse.redirect(url.toString());
  res.cookies.set(COOKIE_NONCE, nonce, flowCookie);
  res.cookies.set(COOKIE_STATE, state, flowCookie);
  return res;
}
