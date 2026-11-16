import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users, workspaces } from "@/lib/db/schema";

export async function requireWorkspace() {
  const session = await auth();
  if (!session?.user?.id || !session.user.workspaceId) redirect("/");

  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, session.user.workspaceId));
  const [user] = await db.select().from(users).where(eq(users.id, session.user.id));

  if (!workspace || !user || user.workspaceId !== workspace.id) redirect("/");

  return { session, workspace, user };
}
