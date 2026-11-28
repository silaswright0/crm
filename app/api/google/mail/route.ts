import { NextResponse } from "next/server";
import { GOOGLE_STATE_COOKIE, googleAuthorizeUrl, googleMailConfigured, signGoogleState } from "@/lib/google-mail";
import { requireWorkspace } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const { workspace } = await requireWorkspace();
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  if (workspace.plan !== "pro") return NextResponse.redirect(`${base}/mail`);
  if (!googleMailConfigured()) return NextResponse.redirect(`${base}/mail?box=config&google=config`);

  const state = signGoogleState(workspace.id);
  const response = NextResponse.redirect(googleAuthorizeUrl(state));
  response.cookies.set(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: base.startsWith("https://"),
    path: "/",
    maxAge: 600,
  });
  return response;
}
