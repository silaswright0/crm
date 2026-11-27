import * as book from "@/lib/book";
import type { BookResult } from "@/lib/book";
import {
  getBoard,
  getCard,
  getMailAccount,
  getOrganization,
  getPerson,
  listAutomations,
  listMessages,
  listOrganizations,
  listPeople,
} from "@/lib/db/queries";
import { hookUrl } from "@/lib/desk";
import { isRecordId } from "@/lib/ids";
import { mailDeliveryFor } from "@/lib/mail";
import type { PipelineKind } from "@/lib/types";

export class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolError";
  }
}

function unwrap<T>(result: BookResult<T>) {
  if (!result.ok) throw new ToolError(result.error);
  return result.data;
}

function str(args: Record<string, unknown>, key: string) {
  const value = args[key];
  return typeof value === "string" ? value.trim() : "";
}

function requiredId(args: Record<string, unknown>, key: string) {
  const value = str(args, key);
  if (!isRecordId(value)) throw new ToolError("That id is not valid.");
  return value;
}

function optionalId(args: Record<string, unknown>, key: string) {
  if (!Object.prototype.hasOwnProperty.call(args, key) || args[key] === undefined) return undefined;
  if (args[key] === null || args[key] === "") return null;
  if (typeof args[key] !== "string" || !isRecordId(args[key])) throw new ToolError("That id is not valid.");
  return args[key];
}

function kindOf(value: unknown): PipelineKind | null {
  return value === "sales" || value === "onboarding" ? value : null;
}

function dollars(args: Record<string, unknown>, key: string) {
  if (!Object.prototype.hasOwnProperty.call(args, key) || args[key] === undefined) return undefined;
  if (args[key] === null) return "";
  if (typeof args[key] === "number" && Number.isFinite(args[key])) return String(args[key]);
  if (typeof args[key] === "string") return args[key];
  throw new ToolError("Value must be a number of dollars.");
}

function portOf(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && value.trim()) return Number.parseInt(value, 10);
  return Number.NaN;
}

const handlers: Record<string, (workspaceId: string, args: Record<string, unknown>) => Promise<unknown>> = {
  async list_people(workspaceId) {
    return listPeople(workspaceId);
  },
  async get_person(workspaceId, args) {
    const row = await getPerson(workspaceId, requiredId(args, "id"));
    if (!row) throw new ToolError("That person is not on this book.");
    return {
      id: row.person.id,
      name: row.person.name,
      email: row.person.email,
      phone: row.person.phone,
      title: row.person.title,
      organizationId: row.person.organizationId,
      organization: row.organization ? { id: row.organization.id, name: row.organization.name } : null,
      quiet: row.quiet,
      lastTouch: row.lastTouch,
      timeline: row.timeline,
      next: row.next,
      cards: row.cards,
    };
  },
  async create_person(workspaceId, args) {
    return unwrap(await book.createPerson(workspaceId, { name: str(args, "name"), email: str(args, "email") }));
  },
  async update_person(workspaceId, args) {
    const id = requiredId(args, "id");
    const current = await getPerson(workspaceId, id);
    if (!current) throw new ToolError("That person is not on this book.");
    const name = Object.prototype.hasOwnProperty.call(args, "name") ? str(args, "name") : current.person.name;
    const organizationId = optionalId(args, "organizationId");
    return unwrap(
      await book.updatePerson(workspaceId, {
        id,
        name,
        email: Object.prototype.hasOwnProperty.call(args, "email") ? str(args, "email") : (current.person.email ?? ""),
        phone: Object.prototype.hasOwnProperty.call(args, "phone") ? str(args, "phone") : (current.person.phone ?? ""),
        title: Object.prototype.hasOwnProperty.call(args, "title") ? str(args, "title") : (current.person.title ?? ""),
        organizationId: organizationId === undefined ? current.person.organizationId : organizationId,
      }),
    );
  },
  async list_organizations(workspaceId) {
    return listOrganizations(workspaceId);
  },
  async get_organization(workspaceId, args) {
    const row = await getOrganization(workspaceId, requiredId(args, "id"));
    if (!row) throw new ToolError("That organization is not on this book.");
    return {
      id: row.organization.id,
      name: row.organization.name,
      domain: row.organization.domain,
      industry: row.organization.industry,
      quiet: row.quiet,
      members: row.members,
      timeline: row.timeline,
      next: row.next,
      cards: row.cards,
    };
  },
  async create_organization(workspaceId, args) {
    return unwrap(await book.createOrganization(workspaceId, { name: str(args, "name"), domain: str(args, "domain") }));
  },
  async update_organization(workspaceId, args) {
    const id = requiredId(args, "id");
    const current = await getOrganization(workspaceId, id);
    if (!current) throw new ToolError("That organization is not on this book.");
    return unwrap(
      await book.updateOrganization(workspaceId, {
        id,
        name: Object.prototype.hasOwnProperty.call(args, "name") ? str(args, "name") : current.organization.name,
        domain: Object.prototype.hasOwnProperty.call(args, "domain") ? str(args, "domain") : (current.organization.domain ?? ""),
        industry: Object.prototype.hasOwnProperty.call(args, "industry")
          ? str(args, "industry")
          : (current.organization.industry ?? ""),
      }),
    );
  },
  async list_stages(workspaceId) {
    const [sales, onboarding] = await Promise.all([getBoard(workspaceId, "sales"), getBoard(workspaceId, "onboarding")]);
    return { sales: sales.stages, onboarding: onboarding.stages };
  },
  async list_cards(workspaceId, args) {
    const kind = args.kind === undefined ? null : kindOf(args.kind);
    if (args.kind !== undefined && !kind) throw new ToolError("Kind is sales or onboarding.");
    const kinds: PipelineKind[] = kind ? [kind] : ["sales", "onboarding"];
    const boards = await Promise.all(kinds.map(async (board) => [board, (await getBoard(workspaceId, board)).cards] as const));
    return Object.fromEntries(boards);
  },
  async get_card(workspaceId, args) {
    const row = await getCard(workspaceId, requiredId(args, "id"));
    if (!row) throw new ToolError("That card is not on this book.");
    return {
      id: row.card.id,
      title: row.card.title,
      comment: row.card.comment,
      valueCents: row.card.valueCents,
      stageId: row.card.stageId,
      stageName: row.stageName,
      stageKind: row.stageKind,
      pipelineKind: row.pipelineKind,
      organizationId: row.card.organizationId,
      organizationName: row.organizationName,
      personId: row.card.personId,
      personName: row.personName,
      personEmail: row.personEmail,
      quiet: row.quiet,
      checks: row.checks,
      timeline: row.timeline,
      next: row.next,
    };
  },
  async create_card(workspaceId, args) {
    return unwrap(
      await book.createCard(workspaceId, {
        stageId: str(args, "stageId"),
        organization: str(args, "organization"),
        person: str(args, "person"),
        title: str(args, "title"),
        value: dollars(args, "value") ?? "",
      }),
    );
  },
  async move_card(workspaceId, args) {
    return unwrap(await book.moveCard(workspaceId, str(args, "cardId"), str(args, "stageId")));
  },
  async update_card(workspaceId, args) {
    const id = requiredId(args, "id");
    const current = await getCard(workspaceId, id);
    if (!current) throw new ToolError("That card is not on this book.");
    const personId = optionalId(args, "personId");
    const value = dollars(args, "value");
    return unwrap(
      await book.updateCard(workspaceId, {
        id,
        title: Object.prototype.hasOwnProperty.call(args, "title") ? str(args, "title") : current.card.title,
        ...(personId !== undefined ? { personId } : {}),
        ...(value !== undefined ? { value } : {}),
      }),
    );
  },
  async delete_card(workspaceId, args) {
    return unwrap(await book.deleteCard(workspaceId, str(args, "id")));
  },
  async add_stage(workspaceId, args) {
    const kind = kindOf(args.kind);
    if (!kind) throw new ToolError("Kind is sales or onboarding.");
    return unwrap(await book.addStage(workspaceId, { kind, name: str(args, "name") }));
  },
  async rename_stage(workspaceId, args) {
    return unwrap(await book.renameStage(workspaceId, { stageId: str(args, "stageId"), name: str(args, "name") }));
  },
  async move_stage(workspaceId, args) {
    const direction = args.direction === "left" || args.direction === "right" ? args.direction : null;
    if (!direction) throw new ToolError("Direction is left or right.");
    return unwrap(await book.moveStage(workspaceId, str(args, "stageId"), direction));
  },
  async delete_stage(workspaceId, args) {
    return unwrap(await book.deleteStage(workspaceId, str(args, "stageId")));
  },
  async add_note(workspaceId, args) {
    const cardId = optionalId(args, "cardId");
    const personId = optionalId(args, "personId");
    const organizationId = optionalId(args, "organizationId");
    return unwrap(
      await book.addNote(workspaceId, {
        body: str(args, "body"),
        cardId: cardId ?? null,
        personId: personId ?? null,
        organizationId: organizationId ?? null,
      }),
    );
  },
  async save_comment(workspaceId, args) {
    return unwrap(
      await book.saveComment(workspaceId, {
        id: str(args, "id"),
        comment: typeof args.comment === "string" ? args.comment : "",
      }),
    );
  },
  async save_next_action(workspaceId, args) {
    const actionId = optionalId(args, "actionId");
    return unwrap(
      await book.saveNextAction(workspaceId, {
        text: str(args, "text"),
        dueOn: str(args, "dueOn"),
        actionId: actionId ?? null,
        cardId: actionId ? null : (optionalId(args, "cardId") ?? null),
        personId: actionId ? null : (optionalId(args, "personId") ?? null),
        organizationId: actionId ? null : (optionalId(args, "organizationId") ?? null),
      }),
    );
  },
  async complete_next_action(workspaceId, args) {
    return unwrap(await book.completeNextAction(workspaceId, str(args, "actionId")));
  },
  async toggle_checklist(workspaceId, args) {
    return unwrap(await book.toggleChecklist(workspaceId, str(args, "itemId")));
  },
  async get_mail_host(workspaceId) {
    const [account, delivery] = await Promise.all([getMailAccount(workspaceId), mailDeliveryFor(workspaceId)]);
    const saved = Boolean(account?.host && account.fromAddress);
    return {
      ready: Boolean(delivery),
      source: saved ? "book" : delivery ? "server" : null,
      host: saved ? account?.host : (delivery?.host ?? null),
      port: saved ? account?.port : (delivery?.port ?? null),
      username: saved ? (account?.username ?? null) : (delivery?.username ?? null),
      fromAddress: saved ? account?.fromAddress : (delivery?.fromAddress ?? null),
      hasPassword: account?.hasPassword ?? false,
    };
  },
  async save_mail_host(workspaceId, args) {
    return unwrap(
      await book.saveMailHost(workspaceId, {
        host: str(args, "host"),
        port: portOf(args.port),
        username: str(args, "username"),
        password: typeof args.password === "string" ? args.password : "",
        fromAddress: str(args, "fromAddress"),
      }),
    );
  },
  async list_mail(workspaceId, args) {
    const box = args.box === "in" || args.box === "out" ? args.box : null;
    if (!box) throw new ToolError("Box is in or out.");
    const rows = await listMessages(workspaceId, box);
    const letters = (box === "out" ? rows.filter((letter) => letter.delivered) : rows).slice(0, 40);
    return letters.map((letter) => ({
      id: letter.id,
      direction: letter.direction,
      fromAddress: letter.fromAddress,
      toAddress: letter.toAddress,
      subject: letter.subject,
      body: letter.body,
      personId: letter.personId,
      createdAt: letter.createdAt,
    }));
  },
  async send_mail(workspaceId, args) {
    return unwrap(
      await book.sendLetter(workspaceId, {
        to: str(args, "to"),
        subject: str(args, "subject"),
        body: typeof args.body === "string" ? args.body : "",
      }),
    );
  },
  async list_automations(workspaceId) {
    const rules = await listAutomations(workspaceId);
    return rules.map((rule) => ({
      id: rule.id,
      name: rule.name,
      triggerKind: rule.triggerKind,
      stageName: rule.stageName,
      pipelineName: rule.pipelineName,
      delayDays: rule.delayDays,
      subject: rule.subject,
      body: rule.body,
      hookUrl: rule.webhookToken ? hookUrl(rule.webhookToken) : null,
    }));
  },
  async create_stage_automation(workspaceId, args) {
    return unwrap(
      await book.createStageAutomation(workspaceId, {
        name: str(args, "name"),
        subject: str(args, "subject"),
        body: typeof args.body === "string" ? args.body : "",
        stageId: str(args, "stageId"),
        delayDays: args.delayDays,
      }),
    );
  },
  async create_webhook_automation(workspaceId, args) {
    const created = unwrap(
      await book.createWebhookAutomation(workspaceId, {
        name: str(args, "name"),
        subject: str(args, "subject"),
        body: typeof args.body === "string" ? args.body : "",
        delayDays: args.delayDays,
      }),
    );
    return { id: created.id, hookUrl: hookUrl(created.webhookToken) };
  },
  async delete_automation(workspaceId, args) {
    return unwrap(await book.deleteAutomation(workspaceId, str(args, "id")));
  },
  async rename_workspace(workspaceId, args) {
    return unwrap(await book.renameWorkspace(workspaceId, str(args, "name")));
  },
};

export async function callTool(workspaceId: string, name: string, args: Record<string, unknown>) {
  const run = handlers[name];
  if (!run) throw new ToolError("That tool is not on this server.");
  return run(workspaceId, args);
}

export const toolNames = new Set(Object.keys(handlers));
