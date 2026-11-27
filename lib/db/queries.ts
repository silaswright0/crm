import { and, asc, desc, eq, ilike, isNotNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  activities,
  automations,
  cards,
  messages,
  checklistItems,
  mailAccounts,
  mcpTokens,
  nextActions,
  organizations,
  people,
  pipelines,
  stages,
} from "@/lib/db/schema";
import { asDate, emailAddress, formatWhen, isQuietAfter, latestStamp, todayISO } from "@/lib/format";
import { isRecordId } from "@/lib/ids";
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

async function mailTouchMap(workspaceId: string) {
  const rows = await db
    .select({
      direction: messages.direction,
      fromAddress: messages.fromAddress,
      toAddress: messages.toAddress,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(
      and(
        eq(messages.workspaceId, workspaceId),
        or(and(eq(messages.direction, "out"), eq(messages.delivered, true)), eq(messages.direction, "in")),
      ),
    );

  const map = new Map<string, Date>();
  for (const row of rows) {
    const email = emailAddress(row.direction === "in" ? row.fromAddress : row.toAddress);
    const stamp = asDate(row.createdAt);
    if (!email || !stamp) continue;
    const prev = map.get(email);
    if (!prev || stamp.getTime() > prev.getTime()) map.set(email, stamp);
  }
  return map;
}

function letterStamp(mail: Map<string, Date>, email: string | null | undefined) {
  const key = emailAddress(email);
  return key ? (mail.get(key) ?? null) : null;
}

function newestLetter(mail: Map<string, Date>, emails: Array<string | null | undefined>) {
  return latestStamp(...emails.map((email) => letterStamp(mail, email)));
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
      updatedAt: people.updatedAt,
    })
    .from(people)
    .leftJoin(organizations, eq(people.organizationId, organizations.id))
    .where(eq(people.workspaceId, workspaceId))
    .orderBy(asc(people.name));

  const touches = await touchMap(workspaceId, "personId");
  const mail = await mailTouchMap(workspaceId);

  return rows.map((row) => {
    const letter = letterStamp(mail, row.email);
    const activity = touches.get(row.id) ?? null;
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      title: row.title,
      organizationName: row.organizationName,
      quiet: isQuietAfter([row.updatedAt, letter]),
      lastTouch: latestStamp(activity, letter),
    };
  });
}

export async function listOrganizations(workspaceId: string) {
  const rows = await db
    .select()
    .from(organizations)
    .where(eq(organizations.workspaceId, workspaceId))
    .orderBy(asc(organizations.name));

  const mail = await mailTouchMap(workspaceId);
  const memberMails = await db
    .select({ organizationId: people.organizationId, email: people.email })
    .from(people)
    .where(and(eq(people.workspaceId, workspaceId), isNotNull(people.organizationId), isNotNull(people.email)));
  const emailsByOrg = new Map<string, string[]>();
  for (const member of memberMails) {
    if (!member.organizationId || !member.email) continue;
    const list = emailsByOrg.get(member.organizationId) ?? [];
    list.push(member.email);
    emailsByOrg.set(member.organizationId, list);
  }
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
    quiet: isQuietAfter([row.updatedAt, newestLetter(mail, emailsByOrg.get(row.id) ?? [])]),
  }));
}

export async function getMcpToken(workspaceId: string) {
  const [row] = await db
    .select({ createdAt: mcpTokens.createdAt })
    .from(mcpTokens)
    .where(eq(mcpTokens.workspaceId, workspaceId));
  return row ?? null;
}

export async function getMailAccount(workspaceId: string) {
  const [row] = await db
    .select({
      host: mailAccounts.host,
      port: mailAccounts.port,
      username: mailAccounts.username,
      fromAddress: mailAccounts.fromAddress,
      hasPassword: sql<boolean>`${mailAccounts.password} <> ''`,
    })
    .from(mailAccounts)
    .where(eq(mailAccounts.workspaceId, workspaceId));
  return row ?? null;
}

export async function listMessages(workspaceId: string, direction: "in" | "out") {
  return db
    .select()
    .from(messages)
    .where(and(eq(messages.workspaceId, workspaceId), eq(messages.direction, direction)))
    .orderBy(desc(messages.createdAt));
}

export async function listAutomationStages(workspaceId: string) {
  return db
    .select({
      id: stages.id,
      name: stages.name,
      pipelineName: pipelines.name,
    })
    .from(stages)
    .innerJoin(pipelines, eq(stages.pipelineId, pipelines.id))
    .where(eq(stages.workspaceId, workspaceId))
    .orderBy(asc(pipelines.kind), asc(stages.position));
}

export async function listAutomations(workspaceId: string) {
  return db
    .select({
      id: automations.id,
      name: automations.name,
      triggerKind: automations.triggerKind,
      stageName: stages.name,
      pipelineName: pipelines.name,
      delayDays: automations.delayDays,
      subject: automations.subject,
      body: automations.body,
      webhookToken: automations.webhookToken,
    })
    .from(automations)
    .leftJoin(stages, eq(automations.stageId, stages.id))
    .leftJoin(pipelines, eq(stages.pipelineId, pipelines.id))
    .where(eq(automations.workspaceId, workspaceId))
    .orderBy(asc(automations.createdAt));
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
      personEmail: people.email,
      valueCents: cards.valueCents,
      updatedAt: cards.updatedAt,
    })
    .from(cards)
    .innerJoin(organizations, eq(cards.organizationId, organizations.id))
    .leftJoin(people, eq(cards.personId, people.id))
    .where(eq(cards.pipelineId, pipeline.id));

  const mail = await mailTouchMap(workspaceId);
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
      quiet: isQuietAfter([card.updatedAt, letterStamp(mail, card.personEmail)]),
      checklistDone: check?.done ?? 0,
      checklistTotal: check?.total ?? 0,
      nextText: nextByCard.get(card.id) ?? null,
    };
  });

  return { stages: boardStages, cards: boardCards };
}

export async function getCounter(workspaceId: string, now = new Date()) {
  const boardSales = await getBoard(workspaceId, "sales");
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthName = (date: Date) => date.toLocaleDateString("en-US", { month: "long" });
  const opened = await db
    .select({ createdAt: cards.createdAt, valueCents: cards.valueCents })
    .from(cards)
    .innerJoin(pipelines, eq(cards.pipelineId, pipelines.id))
    .where(and(eq(cards.workspaceId, workspaceId), eq(pipelines.kind, "sales")));
  const span = (start: Date, end: Date) =>
    opened.filter((card) => {
      const created = asDate(card.createdAt);
      return created != null && created >= start && created < end;
    });
  const current = span(thisMonth, now);
  const previous = span(lastMonth, thisMonth);
  const valueOf = (rows: { valueCents: number | null }[]) => rows.reduce((sum, card) => sum + (card.valueCents ?? 0), 0);

  const openStageIds = new Set(boardSales.stages.filter((stage) => stage.kind === "open").map((stage) => stage.id));
  const stageName = new Map(boardSales.stages.map((stage) => [stage.id, stage.name]));
  const openDeals = boardSales.cards.filter((card) => openStageIds.has(card.stageId));
  const quietDeals = openDeals
    .filter((card) => card.quiet)
    .map((card) => ({
      id: card.id,
      href: `/cards/${card.id}`,
      title: card.title,
      organizationName: card.organizationName,
      stageName: stageName.get(card.stageId) ?? "",
      valueCents: card.valueCents,
    }))
    .sort((a, b) => (b.valueCents ?? -1) - (a.valueCents ?? -1));

  return {
    months: { current: monthName(thisMonth), previous: monthName(lastMonth) },
    fresh: { current: current.length, previous: previous.length },
    freshValue: { current: valueOf(current), previous: valueOf(previous) },
    open: { count: openDeals.length, valueCents: valueOf(openDeals) },
    quietDeals: { count: quietDeals.length, valueCents: valueOf(quietDeals), rows: quietDeals },
  };
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
  if (!isRecordId(id)) return null;
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
  const mail = await mailTouchMap(workspaceId);
  const letter = letterStamp(mail, person.email);
  const activity = touches.get(person.id) ?? null;

  return {
    person,
    organization,
    quiet: isQuietAfter([person.updatedAt, letter]),
    lastTouch: latestStamp(activity, letter),
    timeline: await timelineFor(workspaceId, "personId", id),
    next: await earliestAction(workspaceId, "personId", id),
    cards: await cardsFor(workspaceId, "personId", id),
    organizations: await organizationChoices(workspaceId),
  };
}

export async function getOrganization(workspaceId: string, id: string) {
  if (!isRecordId(id)) return null;
  const [organization] = await db
    .select()
    .from(organizations)
    .where(and(eq(organizations.id, id), eq(organizations.workspaceId, workspaceId)));
  if (!organization) return null;

  const members = await db
    .select({ id: people.id, name: people.name, title: people.title, email: people.email })
    .from(people)
    .where(and(eq(people.workspaceId, workspaceId), eq(people.organizationId, id)))
    .orderBy(asc(people.name));
  const mail = await mailTouchMap(workspaceId);

  return {
    organization,
    members: members.map(({ id: memberId, name, title }) => ({ id: memberId, name, title })),
    quiet: isQuietAfter([organization.updatedAt, newestLetter(mail, members.map((member) => member.email))]),
    timeline: await timelineFor(workspaceId, "organizationId", id),
    next: await earliestAction(workspaceId, "organizationId", id),
    cards: await cardsFor(workspaceId, "organizationId", id),
  };
}

export async function getCard(workspaceId: string, id: string) {
  if (!isRecordId(id)) return null;
  const [row] = await db
    .select({
      card: cards,
      organizationName: organizations.name,
      personName: people.name,
      personEmail: people.email,
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
  const mail = await mailTouchMap(workspaceId);

  return {
    ...row,
    stageKind: row.stageKind as StageKind,
    pipelineKind: row.pipelineKind as PipelineKind,
    checks,
    stages: stageChoices,
    people: await peopleChoices(workspaceId),
    quiet: isQuietAfter([row.card.updatedAt, letterStamp(mail, row.personEmail)]),
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
