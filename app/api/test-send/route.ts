import { NextResponse } from "next/server";

// Placeholder until sign-in exists: real version sends only to the signed-in
// staff member's own address through Resend.
export async function POST() {
  return NextResponse.json({ error: "Test sending is not switched on yet. Sign-in and sending come next." }, { status: 501 });
}
