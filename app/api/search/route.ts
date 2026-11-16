import { auth } from "@/auth";
import { searchBook } from "@/lib/db/queries";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return Response.json({ people: [], organizations: [], cards: [] }, { status: 401 });
  }

  const term = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!term) return Response.json({ people: [], organizations: [], cards: [] });

  const result = await searchBook(session.user.workspaceId, term);
  return Response.json(result);
}
