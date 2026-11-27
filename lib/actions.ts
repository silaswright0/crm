"use server";

import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { db } from "@/lib/db";
import { mcpTokens, users, workspaces } from "@/lib/db/schema";
import { seedWorkspace } from "@/lib/db/seed";
import { isEmail, text } from "@/lib/format";
import * as book from "@/lib/book";
import { isRecordId } from "@/lib/ids";
import { isLocalRepo } from "@/lib/runtime";
import { requireWorkspace } from "@/lib/session";
import type { PipelineKind, Plan } from "@/lib/types";

function refresh() {
  revalidatePath("/", "layout");
}

function optionalId(value: FormDataEntryValue | null) {
  const id = text(value);
  if (!id) return null;
  return isRecordId(id) ? id : undefined;
}

function hasDbCode(error: unknown, code: string) {
  const seen = new Set<unknown>();
  let current = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if ("code" in current && current.code === code) return true;
    current = "cause" in current ? current.cause : undefined;
  }
  return false;
}

function isUniqueViolation(error: unknown) {
  return hasDbCode(error, "23505");
}

function boardHref(kind: PipelineKind, view: string, column?: "full" | "last") {
  const base = kind === "onboarding" ? "/onboarding" : "/sales";
  const path = view === "list" ? `${base}?view=list` : base;
  if (!column) return path;
  return path.includes("?") ? `${path}&column=${column}` : `${path}?column=${column}`;
}

function boardKind(value: string): PipelineKind | null {
  return value === "sales" || value === "onboarding" ? value : null;
}

async function enter(email: string, password: string, failure: string) {
  try {
    await signIn("credentials", { email, password, redirectTo: "/counter" });
  } catch (error) {
    if (!(error instanceof AuthError)) throw error;
    redirect(failure);
  }
}

export async function signup(formData: FormData) {
  const name = text(formData.get("name"));
  const email = text(formData.get("email")).toLowerCase();
  const password = String(formData.get("password") ?? "");
  const workspaceName = text(formData.get("workspace"));

  if (!name || !workspaceName || !password) {
    redirect("/?mode=signup&error=missing");
  }
  if (!isEmail(email)) redirect("/?mode=signup&error=email");

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing) redirect("/?mode=signup&error=taken");

  try {
    await db.transaction(async (tx) => {
      const [workspace] = await tx
        .insert(workspaces)
        .values({ name: workspaceName })
        .returning({ id: workspaces.id });
      if (!workspace) throw new Error("Could not open a workspace.");

      await tx.insert(users).values({
        name,
        email,
        passwordHash: await bcrypt.hash(password, 10),
        workspaceId: workspace.id,
      });
      await seedWorkspace(tx, workspace.id);
    });
  } catch (error) {
    if (isUniqueViolation(error)) redirect("/?mode=signup&error=taken");
    throw error;
  }

  await enter(email, password, "/?error=opened");
}

export async function login(formData: FormData) {
  const email = text(formData.get("email")).toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!isEmail(email)) redirect("/?error=email");
  if (!password) redirect("/?error=CredentialsSignin");
  await enter(email, password, "/?error=CredentialsSignin");
}

export async function logout() {
  await signOut({ redirectTo: "/" });
}

export async function createPerson(formData: FormData) {
  const { workspace } = await requireWorkspace();
  const result = await book.createPerson(workspace.id, {
    name: text(formData.get("name")),
    email: text(formData.get("email")),
  });
  if (!result.ok) return;
  refresh();
  if (text(formData.get("return")) === "record") redirect(`/people/${result.data.id}`);
}

export async function createOrganization(formData: FormData) {
  const { workspace } = await requireWorkspace();
  const result = await book.createOrganization(workspace.id, {
    name: text(formData.get("name")),
    domain: text(formData.get("domain")),
  });
  if (!result.ok) return;
  refresh();
  if (text(formData.get("return")) === "record") redirect(`/organizations/${result.data.id}`);
}

export async function updatePerson(formData: FormData) {
  const { workspace } = await requireWorkspace();
  const organizationId = optionalId(formData.get("organizationId"));
  if (organizationId === undefined) return;
  const result = await book.updatePerson(workspace.id, {
    id: text(formData.get("id")),
    name: text(formData.get("name")),
    email: text(formData.get("email")),
    phone: text(formData.get("phone")),
    title: text(formData.get("title")),
    organizationId,
  });
  if (!result.ok) return;
  refresh();
}

export async function updateOrganization(formData: FormData) {
  const { workspace } = await requireWorkspace();
  const result = await book.updateOrganization(workspace.id, {
    id: text(formData.get("id")),
    name: text(formData.get("name")),
    domain: text(formData.get("domain")),
    industry: text(formData.get("industry")),
  });
  if (!result.ok) return;
  refresh();
}

export async function createCard(formData: FormData) {
  const { workspace } = await requireWorkspace();
  const result = await book.createCard(workspace.id, {
    stageId: text(formData.get("stageId")),
    organization: text(formData.get("organization")),
    person: text(formData.get("person")),
    title: text(formData.get("title")),
    value: text(formData.get("value")),
  });
  if (!result.ok) return;
  refresh();
}

export async function moveCard(cardId: string, stageId: string) {
  const { workspace } = await requireWorkspace();
  const result = await book.moveCard(workspace.id, cardId, stageId);
  if (!result.ok) return;
  refresh();
}

export async function moveCardFromForm(formData: FormData) {
  await moveCard(text(formData.get("cardId")), text(formData.get("stageId")));
}

export async function addStage(formData: FormData) {
  const { workspace } = await requireWorkspace();
  const kind = boardKind(text(formData.get("kind")));
  const view = text(formData.get("view"));
  const name = text(formData.get("name"));
  if (!kind) return;
  if (!name.trim()) redirect(boardHref(kind, view));

  const result = await book.addStage(workspace.id, { kind, name });
  if (!result.ok) return;
  refresh();
  redirect(boardHref(kind, view));
}

export async function deleteStage(formData: FormData) {
  const { workspace } = await requireWorkspace();
  const stageId = text(formData.get("stageId"));
  const view = text(formData.get("view"));
  if (!stageId) return;

  const result = await book.deleteStage(workspace.id, stageId);
  if (!result.ok) {
    if (result.kind && (result.code === "last" || result.code === "full")) {
      redirect(boardHref(result.kind, view, result.code));
    }
    return;
  }
  refresh();
  redirect(boardHref(result.data.kind, view));
}

export async function moveStage(stageId: string, direction: "left" | "right") {
  const { workspace } = await requireWorkspace();
  const result = await book.moveStage(workspace.id, stageId, direction);
  if (!result.ok) return;
  refresh();
}

export async function renameStage(formData: FormData) {
  const { workspace } = await requireWorkspace();
  const view = text(formData.get("view"));
  const result = await book.renameStage(workspace.id, {
    stageId: text(formData.get("stageId")),
    name: text(formData.get("name")),
  });
  if (!result.ok) return;
  refresh();
  redirect(boardHref(result.data.kind, view));
}

export async function editCard(formData: FormData) {
  const { workspace } = await requireWorkspace();
  const result = await book.updateCard(workspace.id, {
    id: text(formData.get("id")),
    title: text(formData.get("title")),
    value: text(formData.get("value")),
  });
  if (!result.ok) return;
  refresh();
}

export async function saveComment(formData: FormData) {
  const { workspace } = await requireWorkspace();
  const result = await book.saveComment(workspace.id, {
    id: text(formData.get("id")),
    comment: String(formData.get("comment") ?? ""),
  });
  if (!result.ok) return;
  refresh();
}

export async function deleteCard(formData: FormData) {
  const { workspace } = await requireWorkspace();
  const result = await book.deleteCard(workspace.id, text(formData.get("id")));
  if (!result.ok) return;
  refresh();
}

export async function updateCard(formData: FormData) {
  const { workspace } = await requireWorkspace();
  const personId = optionalId(formData.get("personId"));
  if (personId === undefined) return;
  const result = await book.updateCard(workspace.id, {
    id: text(formData.get("id")),
    title: text(formData.get("title")),
    personId,
    value: text(formData.get("value")),
  });
  if (!result.ok) return;
  refresh();
}

export async function addNote(formData: FormData) {
  const { workspace } = await requireWorkspace();
  const cardId = optionalId(formData.get("cardId"));
  const personId = optionalId(formData.get("personId"));
  const organizationId = optionalId(formData.get("organizationId"));
  if (cardId === undefined || personId === undefined || organizationId === undefined) return;

  const result = await book.addNote(workspace.id, {
    body: text(formData.get("body")),
    cardId,
    personId,
    organizationId,
  });
  if (!result.ok) return;
  refresh();
}

export async function saveNextAction(formData: FormData) {
  const { workspace } = await requireWorkspace();
  const actionId = optionalId(formData.get("actionId"));
  if (actionId === undefined) return;
  const cardId = actionId ? null : optionalId(formData.get("cardId"));
  const personId = actionId ? null : optionalId(formData.get("personId"));
  const organizationId = actionId ? null : optionalId(formData.get("organizationId"));
  if (cardId === undefined || personId === undefined || organizationId === undefined) return;

  const result = await book.saveNextAction(workspace.id, {
    text: text(formData.get("text")),
    dueOn: text(formData.get("dueOn")),
    actionId,
    cardId,
    personId,
    organizationId,
  });
  if (!result.ok) return;
  refresh();
}

export async function completeNextAction(formData: FormData) {
  const { workspace } = await requireWorkspace();
  const result = await book.completeNextAction(workspace.id, text(formData.get("actionId")));
  if (!result.ok) return;
  refresh();
}

export async function toggleChecklist(formData: FormData) {
  const { workspace } = await requireWorkspace();
  const result = await book.toggleChecklist(workspace.id, text(formData.get("itemId")));
  if (!result.ok) return;
  refresh();
}

async function proWorkspace() {
  const session = await requireWorkspace();
  if (session.workspace.plan !== "pro") return null;
  return session;
}

export async function mintMcpToken() {
  const session = await proWorkspace();
  if (!session) return;
  const token = `ml_${randomBytes(32).toString("hex")}`;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await db
    .insert(mcpTokens)
    .values({
      workspaceId: session.workspace.id,
      userId: session.user.id,
      tokenHash,
    })
    .onConflictDoUpdate({
      target: mcpTokens.workspaceId,
      set: { userId: session.user.id, tokenHash, createdAt: new Date() },
    });
  refresh();
  redirect(`/mcp?issued=${token}`);
}

export async function saveMailAccount(formData: FormData) {
  const session = await proWorkspace();
  if (!session) return;
  const port = Number.parseInt(text(formData.get("port")), 10);
  const result = await book.saveMailHost(session.workspace.id, {
    host: text(formData.get("host")),
    port,
    username: text(formData.get("username")),
    password: String(formData.get("password") ?? ""),
    fromAddress: text(formData.get("fromAddress")),
  });
  if (!result.ok) return;
  refresh();
  redirect("/mail");
}

export async function sendMail(formData: FormData) {
  const session = await proWorkspace();
  if (!session) return;
  const result = await book.sendLetter(session.workspace.id, {
    to: text(formData.get("to")),
    subject: text(formData.get("subject")),
    body: text(formData.get("body")),
  });
  if (!result.ok) {
    if (result.code === "host") redirect("/mail");
    if (result.code === "refused") redirect("/mail?box=write&error=host");
    return;
  }
  refresh();
  redirect("/mail?box=sent");
}

export async function createStageAutomation(formData: FormData) {
  const session = await proWorkspace();
  if (!session) return;
  const result = await book.createStageAutomation(session.workspace.id, {
    name: text(formData.get("name")),
    subject: text(formData.get("subject")),
    body: text(formData.get("body")),
    stageId: text(formData.get("stageId")),
    delayDays: text(formData.get("delayDays")),
  });
  if (!result.ok) return;
  refresh();
}

export async function createWebhookAutomation(formData: FormData) {
  const session = await proWorkspace();
  if (!session) return;
  const result = await book.createWebhookAutomation(session.workspace.id, {
    name: text(formData.get("name")),
    subject: text(formData.get("subject")),
    body: text(formData.get("body")),
    delayDays: text(formData.get("delayDays")),
  });
  if (!result.ok) return;
  refresh();
}

export async function deleteAutomation(formData: FormData) {
  const session = await proWorkspace();
  if (!session) return;
  const result = await book.deleteAutomation(session.workspace.id, text(formData.get("id")));
  if (!result.ok) return;
  refresh();
}

export async function renameWorkspace(formData: FormData) {
  const { workspace } = await requireWorkspace();
  const result = await book.renameWorkspace(workspace.id, text(formData.get("name")));
  if (!result.ok) return;
  refresh();
}

export async function setPlan(formData: FormData) {
  if (!isLocalRepo()) return;
  const { workspace } = await requireWorkspace();
  const plan = text(formData.get("plan"));
  if (plan !== "free" && plan !== "pro") return;
  await db
    .update(workspaces)
    .set({ plan: plan as Plan })
    .where(eq(workspaces.id, workspace.id));
  refresh();
}

export async function holdPlaceholder(formData: FormData) {
  const { workspace } = await requireWorkspace();
  if (workspace.plan !== "pro") return;
  const to = text(formData.get("to"));
  if (to !== "/mail" && to !== "/agents" && !to.startsWith("/mail/")) return;
  redirect(`${to}?notice=held`);
}
