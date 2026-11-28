import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const GOOGLE_STATE_COOKIE = "ml_google_mail";

const MAIL_SCOPE = "openid email https://mail.google.com/";
const MAILBOX_SCOPE = "https://mail.google.com/";

export function hasMailboxScope(scope: string | null | undefined) {
  return (scope ?? "").split(/\s+/).includes(MAILBOX_SCOPE);
}

export function googleMailConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.AUTH_SECRET);
}

export function googleRedirectUri() {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}/api/google/mail/callback`;
}

export function signGoogleState(workspaceId: string) {
  const payload = Buffer.from(
    JSON.stringify({ workspaceId, exp: Date.now() + 10 * 60 * 1000, nonce: randomBytes(16).toString("hex") }),
  ).toString("base64url");
  const secret = process.env.AUTH_SECRET ?? "";
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function readGoogleState(state: string) {
  const secret = process.env.AUTH_SECRET;
  const dot = state.lastIndexOf(".");
  if (!secret || dot < 1) return null;
  const payload = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { workspaceId?: unknown; exp?: unknown };
    if (typeof data.workspaceId !== "string" || typeof data.exp !== "number" || data.exp < Date.now()) return null;
    return { workspaceId: data.workspaceId };
  } catch {
    return null;
  }
}

export function googleAuthorizeUrl(state: string) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", googleRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", MAIL_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url;
}

export async function exchangeGoogleCode(code: string) {
  const token = await googleToken({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    redirect_uri: googleRedirectUri(),
    grant_type: "authorization_code",
  });
  if (!token?.access_token || !token.refresh_token) return { ok: false as const, reason: "token" as const };
  if (!hasMailboxScope(token.scope)) return { ok: false as const, reason: "scope" as const };
  const email = await googleEmail(token.access_token);
  if (!email) return { ok: false as const, reason: "token" as const };
  return { ok: true as const, email, refreshToken: token.refresh_token };
}

export async function googleMailboxToken(refreshToken: string) {
  const token = await googleToken({
    refresh_token: refreshToken,
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    grant_type: "refresh_token",
  });
  if (!token?.access_token) return { ok: false as const, problem: "google" as const };
  const scope = token.scope || (await scopeOf(token.access_token));
  if (!hasMailboxScope(scope)) return { ok: false as const, problem: "google-scope" as const };
  return { ok: true as const, accessToken: token.access_token };
}

async function scopeOf(accessToken: string) {
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`);
  if (!response.ok) return "";
  const json = (await response.json()) as { scope?: unknown };
  return typeof json.scope === "string" ? json.scope : "";
}

async function googleToken(body: Record<string, string>) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const json = (await response.json()) as { access_token?: unknown; refresh_token?: unknown; scope?: unknown };
  if (!response.ok || typeof json.access_token !== "string") return null;
  return {
    access_token: json.access_token,
    refresh_token: typeof json.refresh_token === "string" ? json.refresh_token : null,
    scope: typeof json.scope === "string" ? json.scope : "",
  };
}

async function googleEmail(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  const json = (await response.json()) as { email?: unknown; verified_email?: unknown };
  if (typeof json.email !== "string" || json.verified_email === false) return null;
  return json.email.trim().toLowerCase();
}
