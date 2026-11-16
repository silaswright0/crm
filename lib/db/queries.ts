import { and, asc, desc, eq, ilike, isNotNull, or, sql } from "drizzle-orm";
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
} from "@/lib/db/schema";
import { asDate, formatWhen, isQuiet, todayISO } from "@/lib/format";
import type {
  ActivityKind,
  BoardCard,
  BoardStage,
  Choice,
  LinkedCard,
  NextActionView,
  PipelineKind,
  StageKind,
  TimelineItem,
} from "@/lib/types";

async function touchMap(
  workspaceId: string,
  column: "cardId" | "personId" | "organizationId",
) {
  const field = activities[column];
  const rows = await db
    .select({
      id: field,
      last: sql<string>`max(${activities.createdAt})`,
    })
    .from(activities)
    .where(and(eq(activities.workspaceId, workspaceId), isNotNull(field)))
    .groupBy(field);

  const map = new Map<string, Date>();
  for (const row of rows) {
    const stamp = asDate(row.last);
    if (row.id && stamp) map.set(row.id, stamp);
  }
  return map;
}

function toNext(row: { id: string; text: string; dueOn: string } | undefined): NextActionView | null {
  if (!row) return null;
  return {
    id: row.id,
    text: row.text,
    dueOn: row.dueOn,
    overdue: row.dueOn < todayISO(),
  };
}

export async function listPeople(workspaceId: string) {
  const rows = await db
    .select({
      id: people.id,
      name: people.name,
      email: people.email,
      title: people.title,
      organizationName: organizations.name,
      createdAt: people.createdAt,
    })
    .from(people)
    .leftJoin(organizations, eq(people.organizationId, organizations.id))
    .where(eq(people.workspaceId, workspaceId))
    .orderBy(asc(people.name));

  const touches = await touchMap(workspaceId, "personId");
  const openRows = await db
    .select({ personId: cards.personId })
    .from(cards)
    .innerJoin(stages, eq(cards.stageId, stages.id))
    .where(and(eq(cards.workspaceId, workspaceId), eq(stages.kind, "open"), isNotNull(cards.personId)));
  const open = new Set(openRows.map((row) => row.personId).filter((id): id is string => Boolean(id)));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    title: row.title,
    organizationName: row.organizationName,
    quiet: isQuiet(touches.get(row.id) ?? null, row.createdAt),
    hasOpenCard: open.has(row.id),
  }));
}

export async function listOrganizations(workspaceId: string) {
  const rows = await db
    .select()
    .from(organizations)
    .where(eq(organizations.workspaceId, workspaceId))
    .orderBy(asc(organizations.name));

  const touches = await touchMap(workspaceId, "organizationId");
  const openRows = await db
    .select({ organizationId: cards.organizationId })
    .from(cards)
    .innerJoin(stages, eq(cards.stageId, stages.id))
    .where(and(eq(cards.workspaceId, workspaceId), eq(stages.kind, "open")));
  const open = new Set(openRows.map((row) => row.organizationId));
  const counts = await db
    .select({
      organizationId: people.organizationId,
      total: sql<number>`cast(count(*) as int)`,
    })
    .from(people)
    .where(and(eq(people.workspaceId, workspaceId), isNotNull(people.organizationId)))
    .groupBy(people.organizationId);
  const peopleCount = new Map(counts.map((row) => [row.organizationId, row.total]));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    domain: row.domain,
    industry: row.industry,
    peopleCount: peopleCount.get(row.id) ?? 0,
    quiet: isQuiet(touches.get(row.id) ?? null, row.createdAt),
    hasOpenCard: open.has(row.id),
  }));
}

export async function getBoard(workspaceId: string, kind: PipelineKind) {
  const [pipeline] = await db
    .select()
    .from(pipelines)
    .where(and(eq(pipelines.workspaceId, workspaceId), eq(pipelines.kind, kind)));

  if (!pipeline) {
    return { stages: [] as BoardStage[], cards: [] as BoardCard[] };
  }

  const stageRows = await db
    .select()
    .from(stages)
    .where(eq(stages.pipelineId, pipeline.id))
    .orderBy(asc(stages.position));

  const cardRows = await db
    .select({
      id: cards.id,
      title: cards.title,
      stageId: cards.stageId,
      organizationName: organizations.name,
      personName: people.name,
      valueCents: cards.valueCents,
      createdAt: cards.createdAt,
    })
    .from(cards)
    .innerJoin(organizations, eq(cards.organizationId, organizations.id))
    .leftJoin(people, eq(cards.personId, people.id))
    .where(eq(cards.pipelineId, pipeline.id));

  const touches = await touchMap(workspaceId, "cardId");
  const checks = await db
    .select({
      cardId: checklistItems.cardId,
      total: sql<number>`cast(count(*) as int)`,
      done: sql<number>`cast(count(*) filter (where ${checklistItems.done}) as int)`,
    })
    .from(checklistItems)
    .innerJoin(cards, eq(checklistItems.cardId, cards.id))
    .where(eq(cards.pipelineId, pipeline.id))
    .groupBy(checklistItems.cardId);
  const checkMap = new Map(checks.map((row) => [row.cardId, row]));

  const actionRows = await db
    .select({ cardId: nextActions.cardId, text: nextActions.text, dueOn: nextActions.dueOn })
    .from(nextActions)
    .where(and(eq(nextActions.workspaceId, workspaceId), eq(nextActions.done, false), isNotNull(nextActions.cardId)))
    .orderBy(asc(nextActions.dueOn));
  const nextByCard = new Map<string, string>();
  for (const row of actionRows) {
    if (row.cardId && !nextByCard.has(row.cardId)) nextByCard.set(row.cardId, row.text);
  }

  const boardStages: BoardStage[] = stageRows.map((stage) => ({
    id: stage.id,
    name: stage.name,
    kind: stage.kind,
    position: stage.position,
  }));

  const boardCards: BoardCard[] = cardRows.map((card) => {
    const check = checkMap.get(card.id);
    return {
      id: card.id,
      title: card.title,
      stageId: card.stageId,
      organizationName: card.organizationName,
      personName: card.personName,
      valueCents: card.valueCents,
      quiet: isQuiet(touches.get(card.id) ?? null, card.createdAt),
      checklistDone: check?.done ?? 0,
      checklistTotal: check?.total ?? 0,
      nextText: nextByCard.get(card.id) ?? null,
    };
  });

  return { stages: boardStages, cards: boardCards };
}

export async function getCounter(workspaceId: string) {
  const boardSales = await getBoard(workspaceId, "sales");
  const boardOnboarding = await getBoard(workspaceId, "onboarding");
  const due = await db
    .select({
      id: nextActions.id,
      text: nextActions.text,
      dueOn: nextActions.dueOn,
      cardId: nextActions.cardId,
      personId: nextActions.personId,
      organizationId: nextActions.organizationId,
      cardTitle: cards.title,
      personName: people.name,
      organizationName: organizations.name,
    })
    .from(nextActions)
    .leftJoin(cards, eq(nextActions.cardId, cards.id))
    .leftJoin(people, eq(nextActions.personId, people.id))
    .leftJoin(organizations, eq(nextActions.organizationId, organizations.id))
    .where(
      and(
        eq(nextActions.workspaceId, workspaceId),
        eq(nextActions.done, false),
        sql`${nextActions.dueOn} <= ${todayISO()}::date`,
      ),
    )
    .orderBy(asc(nextActions.dueOn));

  const seen = new Set<string>();
  const quietCards = new Map(
    [...boardSales.cards, ...boardOnboarding.cards].filter((card) => card.quiet).map((card) => [card.id, card]),
  );
  const touches: { href: string; title: string; detail: string; tone: "due" | "quiet" }[] = [];

  for (const action of due) {
    const href = action.cardId
      ? `/cards/${action.cardId}`
      : action.personId
        ? `/people/${action.personId}`
        : action.organizationId
          ? `/organizations/${action.organizationId}`
          : "/counter";
    const title = action.cardTitle ?? action.personName ?? action.organizationName ?? "Next step";
    const quiet = action.cardId ? quietCards.has(action.cardId) : false;
    touches.push({
      href,
      title,
      detail: `${action.dueOn < todayISO() ? "Overdue" : "Due"} ${formatWhen(action.dueOn)} · ${action.text}`,
      tone: quiet ? "quiet" : "due",
    });
    if (action.cardId) seen.add(action.cardId);
  }

  for (const card of quietCards.values()) {
    if (seen.has(card.id)) continue;
    touches.push({
      href: `/cards/${card.id}`,
      title: card.title,
      detail: `${card.organizationName} · no touch in over a week`,
      tone: "quiet",
    });
  }

  const sales = boardSales.stages.map((stage) => {
    const inStage = boardSales.cards.filter((card) => card.stageId === stage.id);
    return {
      id: stage.id,
      name: stage.name,
      kind: stage.kind,
      count: inStage.length,
      valueCents: inStage.reduce((sum, card) => sum + (card.valueCents ?? 0), 0),
      href: `/sales#${stage.id}`,
    };
  });

  const onboarding = boardOnboarding.stages.map((stage) => {
    const inStage = boardOnboarding.cards.filter((card) => card.stageId === stage.id);
    return {
      id: stage.id,
      name: stage.name,
      kind: stage.kind,
      count: inStage.length,
      stuck: inStage.filter((card) => card.quiet).length,
      href: `/onboarding#${stage.id}`,
    };
  });

  return { touches, sales, onboarding };
}

async function timelineFor(
  workspaceId: string,
  column: "cardId" | "personId" | "organizationId",
  id: string,
): Promise<TimelineItem[]> {
  const rows = await db
    .select()
    .from(activities)
    .where(and(eq(activities.workspaceId, workspaceId), eq(activities[column], id)))
    .orderBy(desc(activities.createdAt))
    .limit(50);

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    body: row.body,
    when: formatWhen(row.createdAt),
  }));
}

async function earliestAction(
  workspaceId: string,
  column: "cardId" | "personId" | "organizationId",
  id: string,
) {
  const [row] = await db
    .select({ id: nextActions.id, text: nextActions.text, dueOn: nextActions.dueOn })
    .from(nextActions)
    .where(
      and(
        eq(nextActions.workspaceId, workspaceId),
        eq(nextActions.done, false),
        eq(nextActions[column], id),
      ),
    )
    .orderBy(asc(nextActions.dueOn))
    .limit(1);
  return toNext(row);
}

export async function organizationChoices(workspaceId: string): Promise<Choice[]> {
  const rows = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(eq(organizations.workspaceId, workspaceId))
    .orderBy(asc(organizations.name));
  return rows;
}

export async function peopleChoices(workspaceId: string): Promise<Choice[]> {
  const rows = await db
    .select({ id: people.id, name: people.name })
    .from(people)
    .where(eq(people.workspaceId, workspaceId))
    .orderBy(asc(people.name));
  return rows;
}

async function cardsFor(
  workspaceId: string,
  column: "personId" | "organizationId",
  id: string,
): Promise<LinkedCard[]> {
  const rows = await db
    .select({
      id: cards.id,
      title: cards.title,
      stageName: stages.name,
    })
    .from(cards)
    .innerJoin(stages, eq(cards.stageId, stages.id))
    .where(and(eq(cards.workspaceId, workspaceId), eq(cards[column], id)))
    .orderBy(desc(cards.updatedAt));

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    stageName: row.stageName,
    href: `/cards/${row.id}`,
  }));
}

export async function getPerson(workspaceId: string, id: string) {
  const [person] = await db
    .select()
    .from(people)
    .where(and(eq(people.id, id), eq(people.workspaceId, workspaceId)));
  if (!person) return null;

  const organization = person.organizationId
    ? await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, person.organizationId))
        .then((rows) => rows[0] ?? null)
    : null;
  const touches = await touchMap(workspaceId, "personId");

  return {
    person,
    organization,
    quiet: isQuiet(touches.get(person.id) ?? null, person.createdAt),
    timeline: await timelineFor(workspaceId, "personId", id),
    next: await earliestAction(workspaceId, "personId", id),
    cards: await cardsFor(workspaceId, "personId", id),
    organizations: await organizationChoices(workspaceId),
  };
}

export async function getOrganization(workspaceId: string, id: string) {
  const [organization] = await db
    .select()
    .from(organizations)
    .where(and(eq(organizations.id, id), eq(organizations.workspaceId, workspaceId)));
  if (!organization) return null;

  const members = await db
    .select({ id: people.id, name: people.name, title: people.title })
    .from(people)
    .where(and(eq(people.workspaceId, workspaceId), eq(people.organizationId, id)))
    .orderBy(asc(people.name));
  const touches = await touchMap(workspaceId, "organizationId");

  return {
    organization,
    members,
    quiet: isQuiet(touches.get(organization.id) ?? null, organization.createdAt),
    timeline: await timelineFor(workspaceId, "organizationId", id),
    next: await earliestAction(workspaceId, "organizationId", id),
    cards: await cardsFor(workspaceId, "organizationId", id),
  };
}

export async function getCard(workspaceId: string, id: string) {
  const [row] = await db
    .select({
      card: cards,
      organizationName: organizations.name,
      personName: people.name,
      stageName: stages.name,
      stageKind: stages.kind,
      pipelineKind: pipelines.kind,
    })
    .from(cards)
    .innerJoin(organizations, eq(cards.organizationId, organizations.id))
    .innerJoin(stages, eq(cards.stageId, stages.id))
    .innerJoin(pipelines, eq(cards.pipelineId, pipelines.id))
    .leftJoin(people, eq(cards.personId, people.id))
    .where(and(eq(cards.id, id), eq(cards.workspaceId, workspaceId)));
  if (!row) return null;

  const checks = await db
    .select()
    .from(checklistItems)
    .where(eq(checklistItems.cardId, id))
    .orderBy(asc(checklistItems.position));
  const stageChoices = await db
    .select({ id: stages.id, name: stages.name, kind: stages.kind })
    .from(stages)
    .where(eq(stages.pipelineId, row.card.pipelineId))
    .orderBy(asc(stages.position));
  const touches = await touchMap(workspaceId, "cardId");

  return {
    ...row,
    stageKind: row.stageKind as StageKind,
    pipelineKind: row.pipelineKind as PipelineKind,
    checks,
    stages: stageChoices,
    people: await peopleChoices(workspaceId),
    quiet: isQuiet(touches.get(id) ?? null, row.card.createdAt),
    timeline: await timelineFor(workspaceId, "cardId", id),
    next: await earliestAction(workspaceId, "cardId", id),
  };
}

export async function searchBook(workspaceId: string, term: string) {
  const query = `%${term.replace(/[%_]/g, "")}%`;
  const [foundPeople, foundOrganizations, foundCards] = await Promise.all([
    db
      .select({ id: people.id, name: people.name, email: people.email })
      .from(people)
      .where(
        and(
          eq(people.workspaceId, workspaceId),
          or(ilike(people.name, query), ilike(people.email, query)),
        ),
      )
      .orderBy(asc(people.name))
      .limit(6),
    db
      .select({ id: organizations.id, name: organizations.name, domain: organizations.domain })
      .from(organizations)
      .where(
        and(
          eq(organizations.workspaceId, workspaceId),
          or(ilike(organizations.name, query), ilike(organizations.domain, query)),
        ),
      )
      .orderBy(asc(organizations.name))
      .limit(6),
    db
      .select({ id: cards.id, title: cards.title, organizationName: organizations.name })
      .from(cards)
      .innerJoin(organizations, eq(cards.organizationId, organizations.id))
      .where(and(eq(cards.workspaceId, workspaceId), ilike(cards.title, query)))
      .orderBy(asc(cards.title))
      .limit(6),
  ]);

  return { people: foundPeople, organizations: foundOrganizations, cards: foundCards };
}

export function activityKicker(kind: ActivityKind) {
  if (kind === "note") return "Note";
  if (kind === "stage_change") return "Stage";
  return "Opened";
}
