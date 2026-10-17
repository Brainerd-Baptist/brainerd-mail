import { NextResponse } from "next/server";

// Stores a (already resized) photo and returns a public https address that
// email apps can load. Wired to Supabase Storage once the project exists.
// Only signed-in staff reach this route (see middleware.ts).
export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Photo storage is not connected yet" }, { status: 501 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) return NextResponse.json({ error: "No photo received" }, { status: 400 });
  if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: "Photo is too large" }, { status: 413 });

  const name = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.jpg`;
  const res = await fetch(`${url}/storage/v1/object/email-images/${name}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "image/jpeg", "x-upsert": "false" },
    body: file,
  });
  if (!res.ok) return NextResponse.json({ error: "Could not store the photo" }, { status: 502 });
  return NextResponse.json({ url: `${url}/storage/v1/object/public/email-images/${name}` });
}
