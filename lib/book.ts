import { randomBytes } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  activities,
  automations,
  cards,
  checklistItems,
  mailAccounts,
  messages,
  nextActions,
  organizations,
  people,
  pipelines,
  stages,
  workspaces,
} from "@/lib/db/schema";
import { isEmail, parseDollars, todayISO } from "@/lib/format";
import { isRecordId } from "@/lib/ids";
import { deliverMail, mailDeliveryFor, mailProblems, type MailProblem } from "@/lib/mail";
import { enqueueStageLetters } from "@/lib/schedule";
import { ONBOARDING_STEPS } from "@/lib/pipelines";
import type { PipelineKind } from "@/lib/types";

export type BookErr = {
  ok: false;
  error: string;
  code?: "missing" | "last" | "full" | "invalid" | "delay" | "host" | MailProblem;
  kind?: PipelineKind;
};

export type BookResult<T> = { ok: true; data: T } | BookErr;

function ok<T>(data: T): BookResult<T> {
  return { ok: true, data };
}

function err(error: string, code?: BookErr["code"], kind?: PipelineKind): BookErr {
  return { ok: false, error, code, kind };
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

function recordId(value: string) {
  return isRecordId(value) ? value : "";
}

const DAY_HOURS = 24;
const MAX_WAIT_DAYS = 90;

export function waitSpan(daysValue: unknown, hoursValue: unknown) {
  const days = wholeNumber(daysValue, MAX_WAIT_DAYS);
  const hours = wholeNumber(hoursValue, DAY_HOURS - 1);
  if (days === null || hours === null) return null;
  const total = days * DAY_HOURS + hours;
  if (total > MAX_WAIT_DAYS * DAY_HOURS) return null;
  return total;
}

function wholeNumber(value: unknown, max: number) {
  if (value === null || value === undefined) return 0;
  let parsed: number;
  if (typeof value === "number") {
    parsed = value;
  } else {
    const raw = String(value).trim();
    if (!raw) return 0;
    if (!/^\d+$/.test(raw)) return null;
    parsed = Number(raw);
  }
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > max) return null;
  return parsed;
}

const WAIT_ERROR = "Wait is whole days and hours, up to 90 days.";

function mailFrom(raw: string) {
  const angle = raw.match(/<([^>]+)>/);
  const email = (angle?.[1] ?? raw).trim();
  if (!isEmail(email)) return null;
  return raw.trim();
}

function dueDate(value: string) {
  if (!value) return todayISO();
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export async function createPerson(workspaceId: string, input: { name: string; email: string }) {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) return err("A name is required.", "invalid");
  if (email && !isEmail(email)) return err("Use an email address.", "invalid");

  const [person] = await db
    .insert(people)
    .values({ workspaceId, name, email: email || null })
    .returning({ id: people.id });
  if (!person) return err("Could not add the person.");

  await db.insert(activities).values({
    workspaceId,
    personId: person.id,
    kind: "created",
    body: "Added to the book.",
  });
  return ok({ id: person.id });
}

export async function updatePerson(
  workspaceId: string,
  input: {
    id: string;
    name: string;
    email: string;
    phone: string;
    title: string;
    organizationId: string | null;
  },
) {
  const id = recordId(input.id);
  const name = input.name.trim();
  if (!id || !name) return err("A person and a name are required.", "invalid");
  const email = input.email.trim().toLowerCase();
  if (email && !isEmail(email)) return err("Use an email address.", "invalid");
  if (input.organizationId && !recordId(input.organizationId)) return err("That organization id is not valid.", "invalid");
  if (input.organizationId) {
    const [organization] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(and(eq(organizations.id, input.organizationId), eq(organizations.workspaceId, workspaceId)));
    if (!organization) return err("That organization is not on this book.", "missing");
  }

  const [person] = await db
    .update(people)
    .set({
      name,
      email: email || null,
      phone: input.phone.trim() || null,
      title: input.title.trim() || null,
      organizationId: input.organizationId || null,
      updatedAt: new Date(),
    })
    .where(and(eq(people.id, id), eq(people.workspaceId, workspaceId)))
    .returning({ id: people.id });
  if (!person) return err("That person is not on this book.", "missing");
  return ok({ id: person.id });
}

export async function createOrganization(workspaceId: string, input: { name: string; domain: string }) {
  const name = input.name.trim();
  if (!name) return err("A name is required.", "invalid");

  const [organization] = await db
    .insert(organizations)
    .values({ workspaceId, name, domain: input.domain.trim() || null })
    .returning({ id: organizations.id });
  if (!organization) return err("Could not add the organization.");

  await db.insert(activities).values({
    workspaceId,
    organizationId: organization.id,
    kind: "created",
    body: "Added to the book.",
  });
  return ok({ id: organization.id });
}

export async function updateOrganization(
  workspaceId: string,
  input: { id: string; name: string; domain: string; industry: string },
) {
  const id = recordId(input.id);
  const name = input.name.trim();
  if (!id || !name) return err("An organization and a name are required.", "invalid");

  const [organization] = await db
    .update(organizations)
    .set({
      name,
      domain: input.domain.trim() || null,
      industry: input.industry.trim() || null,
      updatedAt: new Date(),
    })
    .where(and(eq(organizations.id, id), eq(organizations.workspaceId, workspaceId)))
    .returning({ id: organizations.id });
  if (!organization) return err("That organization is not on this book.", "missing");
  return ok({ id: organization.id });
}

async function findOrCreateOrganization(workspaceId: string, name: string) {
  const [existing] = await db
    .select()
    .from(organizations)
    .where(and(eq(organizations.workspaceId, workspaceId), sql`lower(${organizations.name}) = ${name.toLowerCase()}`));
  if (existing) return existing;

  const [created] = await db.insert(organizations).values({ workspaceId, name }).returning();
  if (!created) return null;
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
    .where(and(eq(people.workspaceId, workspaceId), sql`lower(${people.name}) = ${name.toLowerCase()}`));
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
  if (!created) return null;
  await db.insert(activities).values({
    workspaceId,
    personId: created.id,
    organizationId,
    kind: "created",
    body: "Added to the book.",
  });
  return created.id;
}

export async function createCard(
  workspaceId: string,
  input: { stageId: string; organization: string; person: string; title: string; value: string },
) {
  const stageId = recordId(input.stageId);
  const organizationName = input.organization.trim();
  const personName = input.person.trim();
  if (!stageId || !organizationName) return err("A stage and an organization are required.", "invalid");

  const [stage] = await db
    .select({ stage: stages, pipeline: pipelines })
    .from(stages)
    .innerJoin(pipelines, eq(stages.pipelineId, pipelines.id))
    .where(and(eq(stages.id, stageId), eq(stages.workspaceId, workspaceId)));
  if (!stage) return err("That stage is not on this book.", "missing");

  const organization = await findOrCreateOrganization(workspaceId, organizationName);
  if (!organization) return err("Could not add the organization.");
  const personId = personName ? await findOrCreatePerson(workspaceId, personName, organization.id) : null;
  if (personName && !personId) return err("Could not add the person.");

  const [card] = await db
    .insert(cards)
    .values({
      workspaceId,
      pipelineId: stage.pipeline.id,
      stageId: stage.stage.id,
      organizationId: organization.id,
      personId,
      title: input.title.trim() || organizationName,
      valueCents: stage.pipeline.kind === "sales" ? parseDollars(input.value) : null,
    })
    .returning({ id: cards.id });
  if (!card) return err("Could not open the card.");

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
    workspaceId,
    cardId: card.id,
    personId,
    organizationId: organization.id,
    kind: "created",
    body: "Opened the card.",
  });
  return ok({ id: card.id });
}

export async function moveCard(workspaceId: string, cardId: string, stageId: string) {
  if (!recordId(cardId) || !recordId(stageId)) return err("A card and a stage are required.", "invalid");

  const [card] = await db
    .select()
    .from(cards)
    .where(and(eq(cards.id, cardId), eq(cards.workspaceId, workspaceId)));
  const [nextStage] = await db
    .select()
    .from(stages)
    .where(and(eq(stages.id, stageId), eq(stages.workspaceId, workspaceId)));
  if (!card || !nextStage) return err("That card or stage is not on this book.", "missing");
  if (nextStage.pipelineId !== card.pipelineId) return err("Move the card on the same board.", "invalid");
  if (card.stageId === nextStage.id) return ok({ id: card.id, stageId: nextStage.id, stageName: nextStage.name });

  const [previous] = await db.select().from(stages).where(eq(stages.id, card.stageId));
  await db.update(cards).set({ stageId: nextStage.id, updatedAt: new Date() }).where(eq(cards.id, card.id));
  await db.insert(activities).values({
    workspaceId,
    cardId: card.id,
    personId: card.personId,
    organizationId: card.organizationId,
    kind: "stage_change",
    body: `Moved from ${previous?.name ?? "the last stage"} to ${nextStage.name}.`,
  });
  await enqueueStageLetters(workspaceId, card.personId, nextStage.id);
  return ok({ id: card.id, stageId: nextStage.id, stageName: nextStage.name });
}

export async function addStage(workspaceId: string, input: { kind: PipelineKind; name: string }) {
  const name = input.name.trim().slice(0, 40);
  if (!name) return err("A column name is required.", "invalid");

  const [pipeline] = await db
    .select()
    .from(pipelines)
    .where(and(eq(pipelines.workspaceId, workspaceId), eq(pipelines.kind, input.kind)));
  if (!pipeline) return err("That board is not on this book.", "missing");

  const existing = await db.select().from(stages).where(eq(stages.pipelineId, pipeline.id)).orderBy(asc(stages.position));
  const closing = existing.find((stage) => stage.kind !== "open");
  const position = closing ? closing.position : existing.length;

  let createdId = "";
  await db.transaction(async (tx) => {
    const later = existing.filter((stage) => stage.position >= position).sort((a, b) => b.position - a.position);
    for (const stage of later) {
      await tx.update(stages).set({ position: stage.position + 1 }).where(eq(stages.id, stage.id));
    }
    const [created] = await tx
      .insert(stages)
      .values({ workspaceId, pipelineId: pipeline.id, name, position, kind: "open" })
      .returning({ id: stages.id });
    createdId = created?.id ?? "";
  });
  if (!createdId) return err("Could not add the column.");
  return ok({ id: createdId, name, kind: input.kind });
}

export async function renameStage(workspaceId: string, input: { stageId: string; name: string }) {
  const stageId = recordId(input.stageId);
  const name = input.name.trim().slice(0, 40);
  if (!stageId || !name) return err("A column and a name are required.", "invalid");

  const [row] = await db
    .select({ stage: stages, kind: pipelines.kind })
    .from(stages)
    .innerJoin(pipelines, eq(stages.pipelineId, pipelines.id))
    .where(and(eq(stages.id, stageId), eq(stages.workspaceId, workspaceId)));
  if (!row) return err("That column is not on this book.", "missing");

  await db.update(stages).set({ name }).where(eq(stages.id, row.stage.id));
  return ok({ id: row.stage.id, name, kind: row.kind });
}

export async function moveStage(workspaceId: string, stageId: string, direction: "left" | "right") {
  if (!recordId(stageId) || (direction !== "left" && direction !== "right")) {
    return err("A column and a direction are required.", "invalid");
  }

  const [row] = await db
    .select({ stage: stages })
    .from(stages)
    .where(and(eq(stages.id, stageId), eq(stages.workspaceId, workspaceId)));
  if (!row) return err("That column is not on this book.", "missing");

  const siblings = await db
    .select()
    .from(stages)
    .where(eq(stages.pipelineId, row.stage.pipelineId))
    .orderBy(asc(stages.position));
  const index = siblings.findIndex((stage) => stage.id === row.stage.id);
  const neighbor = siblings[direction === "left" ? index - 1 : index + 1];
  if (!neighbor) return err("That column is already at the end.", "invalid");

  await db.transaction(async (tx) => {
    await tx.update(stages).set({ position: neighbor.position }).where(eq(stages.id, row.stage.id));
    await tx.update(stages).set({ position: row.stage.position }).where(eq(stages.id, neighbor.id));
  });
  return ok({ id: row.stage.id, direction });
}

export async function deleteStage(workspaceId: string, stageId: string) {
  if (!recordId(stageId)) return err("A column is required.", "invalid");

  const [row] = await db
    .select({ stage: stages, kind: pipelines.kind })
    .from(stages)
    .innerJoin(pipelines, eq(stages.pipelineId, pipelines.id))
    .where(and(eq(stages.id, stageId), eq(stages.workspaceId, workspaceId)));
  if (!row) return err("That column is not on this book.", "missing");

  const siblings = await db
    .select()
    .from(stages)
    .where(eq(stages.pipelineId, row.stage.pipelineId))
    .orderBy(asc(stages.position));
  if (siblings.length <= 1) return err("This board needs a column.", "last", row.kind);

  const [occupied] = await db.select({ id: cards.id }).from(cards).where(eq(cards.stageId, row.stage.id)).limit(1);
  if (occupied) return err("Move the cards off this column first.", "full", row.kind);

  const remaining = siblings.filter((stage) => stage.id !== row.stage.id);
  try {
    await db.transaction(async (tx) => {
      await tx.delete(stages).where(and(eq(stages.id, row.stage.id), eq(stages.workspaceId, workspaceId)));
      for (const [index, stage] of remaining.entries()) {
        if (stage.position !== index) {
          await tx.update(stages).set({ position: index }).where(eq(stages.id, stage.id));
        }
      }
    });
  } catch (error) {
    if (hasDbCode(error, "23503")) return err("Move the cards off this column first.", "full", row.kind);
    throw error;
  }
  return ok({ id: row.stage.id, kind: row.kind });
}

export async function updateCard(
  workspaceId: string,
  input: { id: string; title: string; personId?: string | null; value?: string },
) {
  const id = recordId(input.id);
  const title = input.title.trim().slice(0, 120);
  if (!id || !title) return err("A card and a title are required.", "invalid");
  if (input.personId && !recordId(input.personId)) return err("That person id is not valid.", "invalid");

  const [card] = await db
    .select({ card: cards, kind: pipelines.kind })
    .from(cards)
    .innerJoin(pipelines, eq(cards.pipelineId, pipelines.id))
    .where(and(eq(cards.id, id), eq(cards.workspaceId, workspaceId)));
  if (!card) return err("That card is not on this book.", "missing");

  if (input.personId) {
    const [person] = await db
      .select({ id: people.id })
      .from(people)
      .where(and(eq(people.id, input.personId), eq(people.workspaceId, workspaceId)));
    if (!person) return err("That person is not on this book.", "missing");
  }

  await db
    .update(cards)
    .set({
      title,
      ...(input.personId !== undefined ? { personId: input.personId || null } : {}),
      valueCents:
        input.value === undefined ? card.card.valueCents : card.kind === "sales" ? parseDollars(input.value) : card.card.valueCents,
      updatedAt: new Date(),
    })
    .where(eq(cards.id, id));
  return ok({ id });
}

export async function saveComment(workspaceId: string, input: { id: string; comment: string }) {
  const id = recordId(input.id);
  if (!id) return err("A card is required.", "invalid");
  const comment = input.comment.replace(/\r\n/g, "\n").trim();

  const [card] = await db
    .update(cards)
    .set({ comment: comment || null, updatedAt: new Date() })
    .where(and(eq(cards.id, id), eq(cards.workspaceId, workspaceId)))
    .returning({ id: cards.id });
  if (!card) return err("That card is not on this book.", "missing");
  return ok({ id: card.id });
}

export async function deleteCard(workspaceId: string, id: string) {
  if (!recordId(id)) return err("A card is required.", "invalid");
  const [card] = await db
    .delete(cards)
    .where(and(eq(cards.id, id), eq(cards.workspaceId, workspaceId)))
    .returning({ id: cards.id });
  if (!card) return err("That card is not on this book.", "missing");
  return ok({ id: card.id });
}

export async function addNote(
  workspaceId: string,
  input: { body: string; cardId: string | null; personId: string | null; organizationId: string | null },
) {
  const body = input.body.trim();
  if (!body) return err("A note is required.", "invalid");

  let resolvedPerson = input.personId;
  let resolvedOrg = input.organizationId;
  let resolvedCard = input.cardId;

  if (input.cardId) {
    if (!recordId(input.cardId)) return err("That card id is not valid.", "invalid");
    const [card] = await db
      .select()
      .from(cards)
      .where(and(eq(cards.id, input.cardId), eq(cards.workspaceId, workspaceId)));
    if (!card) return err("That card is not on this book.", "missing");
    resolvedPerson = card.personId;
    resolvedOrg = card.organizationId;
    resolvedCard = card.id;
  } else if (input.personId) {
    if (!recordId(input.personId)) return err("That person id is not valid.", "invalid");
    const [person] = await db
      .select()
      .from(people)
      .where(and(eq(people.id, input.personId), eq(people.workspaceId, workspaceId)));
    if (!person) return err("That person is not on this book.", "missing");
    resolvedPerson = person.id;
    resolvedOrg = person.organizationId;
  } else if (input.organizationId) {
    if (!recordId(input.organizationId)) return err("That organization id is not valid.", "invalid");
    const [organization] = await db
      .select()
      .from(organizations)
      .where(and(eq(organizations.id, input.organizationId), eq(organizations.workspaceId, workspaceId)));
    if (!organization) return err("That organization is not on this book.", "missing");
    resolvedOrg = organization.id;
  } else {
    return err("Name a card, a person, or an organization.", "invalid");
  }

  const [note] = await db
    .insert(activities)
    .values({
      workspaceId,
      cardId: resolvedCard,
      personId: resolvedPerson,
      organizationId: resolvedOrg,
      kind: "note",
      body,
    })
    .returning({ id: activities.id });
  if (!note) return err("Could not write the note.");
  return ok({ id: note.id });
}

export async function saveNextAction(
  workspaceId: string,
  input: {
    text: string;
    dueOn: string;
    actionId: string | null;
    cardId: string | null;
    personId: string | null;
    organizationId: string | null;
  },
) {
  const actionText = input.text.trim();
  const dueOn = dueDate(input.dueOn.trim());
  if (!actionText) return err("A next step is required.", "invalid");
  if (!dueOn) return err("Use a date.", "invalid");

  if (input.actionId) {
    if (!recordId(input.actionId)) return err("That next step id is not valid.", "invalid");
    const [action] = await db
      .update(nextActions)
      .set({ text: actionText, dueOn, done: false })
      .where(and(eq(nextActions.id, input.actionId), eq(nextActions.workspaceId, workspaceId)))
      .returning({ id: nextActions.id });
    if (!action) return err("That next step is not on this book.", "missing");
    return ok({ id: action.id });
  }

  if (input.cardId) {
    if (!recordId(input.cardId)) return err("That card id is not valid.", "invalid");
    const [card] = await db
      .select()
      .from(cards)
      .where(and(eq(cards.id, input.cardId), eq(cards.workspaceId, workspaceId)));
    if (!card) return err("That card is not on this book.", "missing");
    const [action] = await db
      .insert(nextActions)
      .values({
        workspaceId,
        cardId: card.id,
        personId: card.personId,
        organizationId: card.organizationId,
        text: actionText,
        dueOn,
      })
      .returning({ id: nextActions.id });
    if (!action) return err("Could not save the next step.");
    return ok({ id: action.id });
  }

  if (input.personId) {
    if (!recordId(input.personId)) return err("That person id is not valid.", "invalid");
    const [person] = await db
      .select()
      .from(people)
      .where(and(eq(people.id, input.personId), eq(people.workspaceId, workspaceId)));
    if (!person) return err("That person is not on this book.", "missing");
    const [action] = await db
      .insert(nextActions)
      .values({
        workspaceId,
        personId: person.id,
        organizationId: person.organizationId,
        text: actionText,
        dueOn,
      })
      .returning({ id: nextActions.id });
    if (!action) return err("Could not save the next step.");
    return ok({ id: action.id });
  }

  if (input.organizationId) {
    if (!recordId(input.organizationId)) return err("That organization id is not valid.", "invalid");
    const [organization] = await db
      .select()
      .from(organizations)
      .where(and(eq(organizations.id, input.organizationId), eq(organizations.workspaceId, workspaceId)));
    if (!organization) return err("That organization is not on this book.", "missing");
    const [action] = await db
      .insert(nextActions)
      .values({ workspaceId, organizationId: organization.id, text: actionText, dueOn })
      .returning({ id: nextActions.id });
    if (!action) return err("Could not save the next step.");
    return ok({ id: action.id });
  }

  return err("Name a card, a person, or an organization.", "invalid");
}

export async function completeNextAction(workspaceId: string, actionId: string) {
  if (!recordId(actionId)) return err("A next step is required.", "invalid");
  const [action] = await db
    .select()
    .from(nextActions)
    .where(and(eq(nextActions.id, actionId), eq(nextActions.workspaceId, workspaceId), eq(nextActions.done, false)));
  if (!action) return err("That next step is not open on this book.", "missing");

  await db.update(nextActions).set({ done: true }).where(eq(nextActions.id, action.id));
  await db.insert(activities).values({
    workspaceId,
    cardId: action.cardId,
    personId: action.personId,
    organizationId: action.organizationId,
    kind: "note",
    body: `Finished: ${action.text}`,
  });
  return ok({ id: action.id });
}

export async function toggleChecklist(workspaceId: string, itemId: string) {
  if (!recordId(itemId)) return err("A checklist step is required.", "invalid");
  const [item] = await db
    .select({ item: checklistItems, card: cards })
    .from(checklistItems)
    .innerJoin(cards, eq(checklistItems.cardId, cards.id))
    .where(and(eq(checklistItems.id, itemId), eq(cards.workspaceId, workspaceId)));
  if (!item) return err("That checklist step is not on this book.", "missing");

  const done = !item.item.done;
  await db.update(checklistItems).set({ done }).where(eq(checklistItems.id, item.item.id));
  await db.insert(activities).values({
    workspaceId,
    cardId: item.card.id,
    personId: item.card.personId,
    organizationId: item.card.organizationId,
    kind: "note",
    body: done ? `Checked “${item.item.label}”.` : `Cleared “${item.item.label}”.`,
  });
  await db.update(cards).set({ updatedAt: new Date() }).where(eq(cards.id, item.card.id));
  return ok({ id: item.item.id, done });
}

export async function saveMailHost(
  workspaceId: string,
  input: { host: string; port: number; username: string; password: string; fromAddress: string },
) {
  const host = input.host.trim();
  const fromAddress = mailFrom(input.fromAddress.trim());
  const username = input.username.trim();
  const port = input.port;
  if (!host || !fromAddress || !Number.isInteger(port) || port < 1 || port > 65535) {
    return err("A host, a port, and a from address are required.", "invalid");
  }

  const [existing] = await db
    .select({ password: mailAccounts.password })
    .from(mailAccounts)
    .where(eq(mailAccounts.workspaceId, workspaceId));

  await db
    .insert(mailAccounts)
    .values({
      workspaceId,
      host,
      port,
      username: username || null,
      password: input.password || existing?.password || "",
      fromAddress,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: mailAccounts.workspaceId,
      set: {
        host,
        port,
        username: username || null,
        password: input.password || existing?.password || "",
        fromAddress,
        updatedAt: new Date(),
      },
    });
  return ok({ host, port, username: username || null, fromAddress });
}

export async function saveGoogleMail(workspaceId: string, input: { email: string; refreshToken: string }) {
  const email = input.email.trim().toLowerCase();
  if (!isEmail(email) || !input.refreshToken) return err("Google did not return a mailbox.", "invalid");

  const [existing] = await db
    .select({ fromAddress: mailAccounts.fromAddress, password: mailAccounts.password })
    .from(mailAccounts)
    .where(eq(mailAccounts.workspaceId, workspaceId));
  const fromAddress = existing?.fromAddress || email;

  await db
    .insert(mailAccounts)
    .values({
      workspaceId,
      host: "smtp.gmail.com",
      port: 587,
      username: email,
      password: existing?.password ?? "",
      fromAddress,
      googleEmail: email,
      googleRefreshToken: input.refreshToken,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: mailAccounts.workspaceId,
      set: {
        host: "smtp.gmail.com",
        port: 587,
        username: email,
        fromAddress,
        googleEmail: email,
        googleRefreshToken: input.refreshToken,
        updatedAt: new Date(),
      },
    });
  return ok({ email });
}

export async function clearGoogleMail(workspaceId: string) {
  await db
    .update(mailAccounts)
    .set({ googleEmail: null, googleRefreshToken: null, updatedAt: new Date() })
    .where(eq(mailAccounts.workspaceId, workspaceId));
  return ok({ cleared: true });
}

export async function sendLetter(workspaceId: string, input: { to: string; subject: string; body: string }) {
  const to = input.to.trim().toLowerCase();
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!isEmail(to) || !subject || !body) return err("A recipient, a subject, and a letter are required.", "invalid");

  const account = await mailDeliveryFor(workspaceId);
  if (!account) return err("Save a mail host before a letter can leave this book.", "host");

  const delivered = await deliverMail(workspaceId, { to, subject, text: body });
  if (!delivered.ok) {
    if (delivered.problem === "login") return err("Save a mail host before a letter can leave this book.", "host");
    return err(mailProblems[delivered.problem].text, delivered.problem);
  }

  const [person] = await db
    .select({ id: people.id })
    .from(people)
    .where(and(eq(people.workspaceId, workspaceId), sql`lower(${people.email}) = ${to}`));

  const [letter] = await db
    .insert(messages)
    .values({
      workspaceId,
      direction: "out",
      fromAddress: account.fromAddress,
      toAddress: to,
      subject,
      body,
      personId: person?.id ?? null,
      delivered: true,
    })
    .returning({ id: messages.id });
  if (!letter) return err("The letter left, but it could not be stored.");
  return ok({ id: letter.id, to, subject, delivered: true });
}

export async function createStageAutomation(
  workspaceId: string,
  input: { name: string; subject: string; body: string; stageId: string; delayDays: unknown; delayHours: unknown },
) {
  const name = input.name.trim();
  const subject = input.subject.trim();
  const body = input.body.trim();
  const stageId = recordId(input.stageId);
  const wait = waitSpan(input.delayDays, input.delayHours);
  if (wait === null) return err(WAIT_ERROR, "delay");
  if (!name || !subject || !body || !stageId) return err("A name, a stage, a subject, and a letter are required.", "invalid");

  const [stage] = await db
    .select({ id: stages.id })
    .from(stages)
    .where(and(eq(stages.id, stageId), eq(stages.workspaceId, workspaceId)));
  if (!stage) return err("That stage is not on this book.", "missing");

  const [rule] = await db
    .insert(automations)
    .values({
      workspaceId,
      name,
      triggerKind: "stage",
      stageId,
      delayHours: wait,
      subject,
      body,
    })
    .returning({ id: automations.id });
  if (!rule) return err("Could not save the rule.");
  return ok({ id: rule.id });
}

export async function createWebhookAutomation(
  workspaceId: string,
  input: { name: string; subject: string; body: string; delayDays: unknown; delayHours: unknown },
) {
  const name = input.name.trim();
  const subject = input.subject.trim();
  const body = input.body.trim();
  const wait = waitSpan(input.delayDays, input.delayHours);
  if (wait === null) return err(WAIT_ERROR, "delay");
  if (!name || !subject || !body) return err("A name, a subject, and a letter are required.", "invalid");

  const [held] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(automations)
    .where(and(eq(automations.workspaceId, workspaceId), eq(automations.triggerKind, "webhook")));
  if ((held?.n ?? 0) >= 128) return err("Only 128 webhook automations per org.", "full");

  const webhookToken = randomBytes(16).toString("hex");
  const [rule] = await db
    .insert(automations)
    .values({
      workspaceId,
      name,
      triggerKind: "webhook",
      delayHours: wait,
      subject,
      body,
      webhookToken,
    })
    .returning({ id: automations.id });
  if (!rule) return err("Could not save the rule.");
  return ok({ id: rule.id, webhookToken });
}

export async function deleteAutomation(workspaceId: string, id: string) {
  if (!recordId(id)) return err("A rule is required.", "invalid");
  const [rule] = await db
    .delete(automations)
    .where(and(eq(automations.id, id), eq(automations.workspaceId, workspaceId)))
    .returning({ id: automations.id });
  if (!rule) return err("That rule is not on this book.", "missing");
  return ok({ id: rule.id });
}

export async function renameWorkspace(workspaceId: string, name: string) {
  const next = name.trim();
  if (!next) return err("A workspace name is required.", "invalid");
  await db.update(workspaces).set({ name: next }).where(eq(workspaces.id, workspaceId));
  return ok({ name: next });
}
