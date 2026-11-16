"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { signIn, signOut } from "@/auth";
import { db } from "@/lib/db";
import {
  activities,
  cards,
  checklistItems,
  nextActions,
  organizations,
  people,
  pipelines,
  stages,
  users,
  workspaces,
} from "@/lib/db/schema";
import { seedWorkspace } from "@/lib/db/seed";
import { parseDollars, text, todayISO } from "@/lib/format";
import { ONBOARDING_STEPS } from "@/lib/pipelines";
import { requireWorkspace } from "@/lib/session";
import type { Plan } from "@/lib/types";

function refresh() {
  revalidatePath("/", "layout");
}

export async function signup(formData: FormData) {
  const name = text(formData.get("name"));
  const email = text(formData.get("email")).toLowerCase();
  const password = String(formData.get("password") ?? "");
  const workspaceName = text(formData.get("workspace"));

  if (!name || !email || !workspaceName || !password) {
    redirect("/?mode=signup&error=missing");
  }
  if (password.length < 8) redirect("/?mode=signup&error=short");

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing) redirect("/?mode=signup&error=taken");

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

  await signIn("credentials", { email, password, redirectTo: "/counter" });
}

export async function login(formData: FormData) {
  await signIn("credentials", {
    email: text(formData.get("email")).toLowerCase(),
    password: String(formData.get("password") ?? ""),
    redirectTo: "/counter",
  });
}

export async function logout() {
  await signOut({ redirectTo: "/" });
}

export async function createPerson(formData: FormData) {
  const { workspace } = await requireWorkspace();
  const name = text(formData.get("name"));
  const email = text(formData.get("email")).toLowerCase();
  if (!name) return;

  const [person] = await db
    .insert(people)
    .values({
      workspaceId: workspace.id,
      name,
      email: email || null,
    })
    .returning({ id: people.id });

  if (person) {
    await db.insert(activities).values({
      workspaceId: workspace.id,
      personId: person.id,
      kind: "created",
      body: "Added to the book.",
    });
  }

  refresh();
  if (text(formData.get("return")) === "record" && person) redirect(`/people/${person.id}`);
}

export async function createOrganization(formData: FormData) {
  const { workspace } = await requireWorkspace();
  const name = text(formData.get("name"));
  const domain = text(formData.get("domain"));
  if (!name) return;

  const [organization] = await db
    .insert(organizations)
    .values({
      workspaceId: workspace.id,
      name,
      domain: domain || null,
    })
    .returning({ id: organizations.id });

  if (organization) {
    await db.insert(activities).values({
      workspaceId: workspace.id,
      organizationId: organization.id,
      kind: "created",
      body: "Added to the book.",
    });
  }

  refresh();
  if (text(formData.get("return")) === "record" && organization) {
    redirect(`/organizations/${organization.id}`);
  }
}

export async function updatePerson(formData: FormData) {
  const { workspace } = await requireWorkspace();
  const id = text(formData.get("id"));
  const name = text(formData.get("name"));
  if (!id || !name) return;
  const organizationId = text(formData.get("organizationId"));

  await db
    .update(people)
    .set({
      name,
      email: text(formData.get("email")).toLowerCase() || null,
      phone: text(formData.get("phone")) || null,
      title: text(formData.get("title")) || null,
      organizationId: organizationId || null,
      updatedAt: new Date(),
    })
    .where(and(eq(people.id, id), eq(people.workspaceId, workspace.id)));

  refresh();
}

export async function updateOrganization(formData: FormData) {
  const { workspace } = await requireWorkspace();
  const id = text(formData.get("id"));
  const name = text(formData.get("name"));
  if (!id || !name) return;

  await db
    .update(organizations)
    .set({
      name,
      domain: text(formData.get("domain")) || null,
      industry: text(formData.get("industry")) || null,
      updatedAt: new Date(),
    })
    .where(and(eq(organizations.id, id), eq(organizations.workspaceId, workspace.id)));

  refresh();
}

async function findOrCreateOrganization(workspaceId: string, name: string) {
  const [existing] = await db
    .select()
    .from(organizations)
    .where(
      and(
        eq(organizations.workspaceId, workspaceId),
        sql`lower(${organizations.name}) = ${name.toLowerCase()}`,
      ),
    );
  if (existing) return existing;

  const [created] = await db
    .insert(organizations)
    .values({ workspaceId, name })
    .returning();
  if (!created) throw new Error("Could not add the organization.");
  await db.insert(activities).values({
    workspaceId,
    organizationId: created.id,
    kind: "created",
    body: "Added to the book.",
  });
  return created;
}

async function findOrCreatePerson(workspaceId: string, name: string, organizationId: string) {
  const [existing] = await db
    .select()
    .from(people)
    .where(
      and(
        eq(people.workspaceId, workspaceId),
        sql`lower(${people.name}) = ${name.toLowerCase()}`,
      ),
    );
  if (existing) {
    if (!existing.organizationId) {
      await db
        .update(people)
        .set({ organizationId, updatedAt: new Date() })
        .where(eq(people.id, existing.id));
    }
    return existing.id;
  }

  const [created] = await db
    .insert(people)
    .values({ workspaceId, name, organizationId })
    .returning({ id: people.id });
  if (!created) throw new Error("Could not add the person.");
  await db.insert(activities).values({
    workspaceId,
    personId: created.id,
    organizationId,
    kind: "created",
    body: "Added to the book.",
  });
  return created.id;
}

export async function createCard(formData: FormData) {
  const { workspace } = await requireWorkspace();
  const stageId = text(formData.get("stageId"));
  const organizationName = text(formData.get("organization"));
  const personName = text(formData.get("person"));
  if (!stageId || !organizationName) return;

  const [stage] = await db
    .select({ stage: stages, pipeline: pipelines })
    .from(stages)
    .innerJoin(pipelines, eq(stages.pipelineId, pipelines.id))
    .where(and(eq(stages.id, stageId), eq(stages.workspaceId, workspace.id)));
  if (!stage) return;

  const organization = await findOrCreateOrganization(workspace.id, organizationName);
  const personId = personName
    ? await findOrCreatePerson(workspace.id, personName, organization.id)
    : null;
  const title = text(formData.get("title")) || organizationName;
  const valueCents = stage.pipeline.kind === "sales" ? parseDollars(text(formData.get("value"))) : null;

  const [card] = await db
    .insert(cards)
    .values({
      workspaceId: workspace.id,
      pipelineId: stage.pipeline.id,
      stageId: stage.stage.id,
      organizationId: organization.id,
      personId,
      title,
      valueCents,
    })
    .returning({ id: cards.id });
  if (!card) return;

  if (stage.pipeline.kind === "onboarding") {
    await db.insert(checklistItems).values(
      ONBOARDING_STEPS.map((label, position) => ({
        cardId: card.id,
        label,
        done: false,
        position,
      })),
    );
  }

  await db.insert(activities).values({
    workspaceId: workspace.id,
    cardId: card.id,
    personId,
    organizationId: organization.id,
    kind: "created",
    body: "Opened the card.",
  });

  refresh();
}

export async function moveCard(cardId: string, stageId: string) {
  const { workspace } = await requireWorkspace();
  const [card] = await db
    .select()
    .from(cards)
    .where(and(eq(cards.id, cardId), eq(cards.workspaceId, workspace.id)));
  const [nextStage] = await db
    .select()
    .from(stages)
    .where(and(eq(stages.id, stageId), eq(stages.workspaceId, workspace.id)));
  if (!card || !nextStage || nextStage.pipelineId !== card.pipelineId || card.stageId === nextStage.id) {
    return;
  }

  const [previous] = await db.select().from(stages).where(eq(stages.id, card.stageId));

  await db
    .update(cards)
    .set({ stageId: nextStage.id, updatedAt: new Date() })
    .where(eq(cards.id, card.id));

  await db.insert(activities).values({
    workspaceId: workspace.id,
    cardId: card.id,
    personId: card.personId,
    organizationId: card.organizationId,
    kind: "stage_change",
    body: `Moved from ${previous?.name ?? "the last stage"} to ${nextStage.name}.`,
  });

  refresh();
}

export async function moveCardFromForm(formData: FormData) {
  await moveCard(text(formData.get("cardId")), text(formData.get("stageId")));
}

export async function updateCard(formData: FormData) {
  const { workspace } = await requireWorkspace();
  const id = text(formData.get("id"));
  const title = text(formData.get("title"));
  if (!id || !title) return;

  const [card] = await db
    .select({ card: cards, kind: pipelines.kind })
    .from(cards)
    .innerJoin(pipelines, eq(cards.pipelineId, pipelines.id))
    .where(and(eq(cards.id, id), eq(cards.workspaceId, workspace.id)));
  if (!card) return;

  const personId = text(formData.get("personId"));
  await db
    .update(cards)
    .set({
      title,
      personId: personId || null,
      valueCents: card.kind === "sales" ? parseDollars(text(formData.get("value"))) : card.card.valueCents,
      updatedAt: new Date(),
    })
    .where(eq(cards.id, id));

  refresh();
}

export async function addNote(formData: FormData) {
  const { workspace } = await requireWorkspace();
  const body = text(formData.get("body"));
  if (!body) return;

  const cardId = text(formData.get("cardId"));
  const personId = text(formData.get("personId"));
  const organizationId = text(formData.get("organizationId"));

  let resolvedPerson = personId || null;
  let resolvedOrg = organizationId || null;
  let resolvedCard = cardId || null;

  if (cardId) {
    const [card] = await db
      .select()
      .from(cards)
      .where(and(eq(cards.id, cardId), eq(cards.workspaceId, workspace.id)));
    if (!card) return;
    resolvedPerson = card.personId;
    resolvedOrg = card.organizationId;
    resolvedCard = card.id;
  } else if (personId) {
    const [person] = await db
      .select()
      .from(people)
      .where(and(eq(people.id, personId), eq(people.workspaceId, workspace.id)));
    if (!person) return;
    resolvedPerson = person.id;
    resolvedOrg = person.organizationId;
  } else if (organizationId) {
    const [organization] = await db
      .select()
      .from(organizations)
      .where(and(eq(organizations.id, organizationId), eq(organizations.workspaceId, workspace.id)));
    if (!organization) return;
    resolvedOrg = organization.id;
  } else {
    return;
  }

  await db.insert(activities).values({
    workspaceId: workspace.id,
    cardId: resolvedCard,
    personId: resolvedPerson,
    organizationId: resolvedOrg,
    kind: "note",
    body,
  });

  refresh();
}

export async function saveNextAction(formData: FormData) {
  const { workspace } = await requireWorkspace();
  const actionText = text(formData.get("text"));
  const dueOn = text(formData.get("dueOn")) || todayISO();
  if (!actionText) return;

  const actionId = text(formData.get("actionId"));
  if (actionId) {
    await db
      .update(nextActions)
      .set({ text: actionText, dueOn, done: false })
      .where(and(eq(nextActions.id, actionId), eq(nextActions.workspaceId, workspace.id)));
    refresh();
    return;
  }

  const cardId = text(formData.get("cardId"));
  const personId = text(formData.get("personId"));
  const organizationId = text(formData.get("organizationId"));

  if (cardId) {
    const [card] = await db
      .select()
      .from(cards)
      .where(and(eq(cards.id, cardId), eq(cards.workspaceId, workspace.id)));
    if (!card) return;
    await db.insert(nextActions).values({
      workspaceId: workspace.id,
      cardId: card.id,
      personId: card.personId,
      organizationId: card.organizationId,
      text: actionText,
      dueOn,
    });
  } else if (personId) {
    const [person] = await db
      .select()
      .from(people)
      .where(and(eq(people.id, personId), eq(people.workspaceId, workspace.id)));
    if (!person) return;
    await db.insert(nextActions).values({
      workspaceId: workspace.id,
      personId: person.id,
      organizationId: person.organizationId,
      text: actionText,
      dueOn,
    });
  } else if (organizationId) {
    const [organization] = await db
      .select()
      .from(organizations)
      .where(and(eq(organizations.id, organizationId), eq(organizations.workspaceId, workspace.id)));
    if (!organization) return;
    await db.insert(nextActions).values({
      workspaceId: workspace.id,
      organizationId: organization.id,
      text: actionText,
      dueOn,
    });
  }

  refresh();
}

export async function completeNextAction(formData: FormData) {
  const { workspace } = await requireWorkspace();
  const actionId = text(formData.get("actionId"));
  if (!actionId) return;

  const [action] = await db
    .select()
    .from(nextActions)
    .where(and(eq(nextActions.id, actionId), eq(nextActions.workspaceId, workspace.id), eq(nextActions.done, false)));
  if (!action) return;

  await db.update(nextActions).set({ done: true }).where(eq(nextActions.id, action.id));
  await db.insert(activities).values({
    workspaceId: workspace.id,
    cardId: action.cardId,
    personId: action.personId,
    organizationId: action.organizationId,
    kind: "note",
    body: `Finished: ${action.text}`,
  });
  refresh();
}

export async function toggleChecklist(formData: FormData) {
  const { workspace } = await requireWorkspace();
  const itemId = text(formData.get("itemId"));
  if (!itemId) return;

  const [item] = await db
    .select({ item: checklistItems, card: cards })
    .from(checklistItems)
    .innerJoin(cards, eq(checklistItems.cardId, cards.id))
    .where(and(eq(checklistItems.id, itemId), eq(cards.workspaceId, workspace.id)));
  if (!item) return;

  const done = !item.item.done;
  await db.update(checklistItems).set({ done }).where(eq(checklistItems.id, item.item.id));
  await db.insert(activities).values({
    workspaceId: workspace.id,
    cardId: item.card.id,
    personId: item.card.personId,
    organizationId: item.card.organizationId,
    kind: "note",
    body: done ? `Checked “${item.item.label}”.` : `Cleared “${item.item.label}”.`,
  });
  await db.update(cards).set({ updatedAt: new Date() }).where(eq(cards.id, item.card.id));
  refresh();
}

export async function renameWorkspace(formData: FormData) {
  const { workspace } = await requireWorkspace();
  const name = text(formData.get("name"));
  if (!name) return;
  await db.update(workspaces).set({ name }).where(eq(workspaces.id, workspace.id));
  refresh();
}

export async function setPlan(formData: FormData) {
  const { workspace } = await requireWorkspace();
  const plan = text(formData.get("plan"));
  if (plan !== "counter" && plan !== "desk") return;
  await db
    .update(workspaces)
    .set({ plan: plan as Plan })
    .where(eq(workspaces.id, workspace.id));
  refresh();
}

export async function holdPlaceholder(formData: FormData) {
  const { workspace } = await requireWorkspace();
  if (workspace.plan !== "desk") return;
  const to = text(formData.get("to"));
  if (to !== "/mail" && to !== "/agents" && !to.startsWith("/mail/")) return;
  redirect(`${to}?notice=held`);
}
