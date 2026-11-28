import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import * as book from "@/lib/book";
import { GOOGLE_STATE_COOKIE, exchangeGoogleCode, readGoogleState } from "@/lib/google-mail";
import { requireWorkspace } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function finish(base: string, google: string) {
  const response = NextResponse.redirect(`${base}/mail?box=config&google=${google}`);
  response.cookies.set(GOOGLE_STATE_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}

export async function GET(request: Request) {
  const { workspace } = await requireWorkspace();
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = (await cookies()).get(GOOGLE_STATE_COOKIE)?.value ?? null;

  if (url.searchParams.get("error") || workspace.plan !== "pro") return finish(base, "denied");
  if (!code || !state || !cookieState || !same(state, cookieState)) return finish(base, "state");
  const parsed = readGoogleState(state);
  if (!parsed || parsed.workspaceId !== workspace.id) return finish(base, "state");

  const granted = await exchangeGoogleCode(code);
  if (!granted.ok) return finish(base, granted.reason);
  const savedMail = await book.saveGoogleMail(workspace.id, granted);
  if (!savedMail.ok) return finish(base, "token");
  revalidatePath("/", "layout");
  return finish(base, "connected");
}

function same(left: string, right: string) {
  return left.length === right.length && left === right;
}
