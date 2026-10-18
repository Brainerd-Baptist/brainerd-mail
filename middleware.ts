import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Everything needs a signed-in staff member except the public pages readers use.
const PUBLIC = ["/login", "/auth", "/brand/", "/w/", "/r/", "/u/", "/api/pray", "/manifest.webmanifest", "/icons/", "/sample/", "/_next/", "/favicon"];

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (PUBLIC.some((p) => path.startsWith(p)) || path === "/serving") return NextResponse.next();
  // Scheduled jobs authenticate with their own secret, not a login.
  if (path.startsWith("/api/cron/")) return NextResponse.next();

  // Until the database keys are set, keep the preview-only editor open.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.next();

  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list: { name: string; value: string; options?: any }[]) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    // Signed in is not enough: they must still be an active member of the team (removed or deactivated people are bounced on their next click).
    const { data: row, error } = await supabase.from("staff").select("disabled_at").eq("user_id", data.user.id).maybeSingle();
    if (error || (row && !row.disabled_at)) return res;
    if (path.startsWith("/api/")) return NextResponse.json({ error: "Your access to Brainerd Mail has changed." }, { status: 403 });
    const back = req.nextUrl.clone();
    back.pathname = "/login";
    back.search = "?error=denied";
    return NextResponse.redirect(back);
  }

  if (path.startsWith("/api/")) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
