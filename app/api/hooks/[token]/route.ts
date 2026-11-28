import { enqueueWebhook } from "@/lib/schedule";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return Response.json({ error: "POST a JSON body with an email." }, { status: 405, headers: { Allow: "POST" } });
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "POST a JSON body with an email." }, { status: 400 });
  }
  const email = body && typeof body === "object" && "email" in body ? String((body as { email: unknown }).email) : "";
  const result = await enqueueWebhook(token, email);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ ok: true, dueAt: result.dueAt }, { status: 202 });
}
