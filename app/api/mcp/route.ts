import { handleMcp } from "@/lib/mcp/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST, DELETE" } });
}

export function DELETE() {
  return new Response(null, { status: 200 });
}

export function POST(request: Request) {
  return handleMcp(request);
}
