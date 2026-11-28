import nodemailer from "nodemailer";
import { ImapFlow, type MessageEnvelopeObject } from "imapflow";
import { simpleParser } from "mailparser";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { mailAccounts, messages, people } from "@/lib/db/schema";
import { emailAddress } from "@/lib/format";
import { googleMailboxToken } from "@/lib/google-mail";

export type MailDelivery = {
  host: string;
  port: number;
  username: string | null;
  password: string;
  fromAddress: string;
  refreshToken: string | null;
};

export async function mailDeliveryFor(workspaceId: string): Promise<MailDelivery | null> {
  const [row] = await db.select().from(mailAccounts).where(eq(mailAccounts.workspaceId, workspaceId));
  if (row?.googleRefreshToken && row.googleEmail) {
    return {
      host: "smtp.gmail.com",
      port: 587,
      username: row.googleEmail,
      password: row.password,
      fromAddress: row.fromAddress || row.googleEmail,
      refreshToken: row.googleRefreshToken,
    };
  }

  if (row?.host && row.fromAddress) {
    return {
      host: row.host,
      port: row.port,
      username: row.username,
      password: row.password,
      fromAddress: row.fromAddress,
      refreshToken: null,
    };
  }

  const host = process.env.SMTP_HOST?.trim();
  const fromAddress = process.env.MAIL_FROM?.trim();
  if (!host || !fromAddress) return null;
  return {
    host,
    port: Number(process.env.SMTP_PORT || 587),
    username: process.env.SMTP_USER?.trim() || null,
    password: process.env.SMTP_PASS ?? "",
    fromAddress,
    refreshToken: null,
  };
}

export const mailProblems = {
  "second-factor": {
    label: "2-step verification",
    text: "Gmail received the sign-in password and will not use it for mail. This form cannot ask for the code. Sign in with Google from Config, or save an app password.",
  },
  google: {
    label: "Google sign-in expired",
    text: "Sign in with Google again from Config.",
  },
  "google-scope": {
    label: "Mailbox access missing",
    text: "Google signed you in, but it did not allow this book to open the mailbox. In Google Auth Platform, open Data Access, add https://mail.google.com/, then use Sign in with Google again.",
  },
  password: {
    label: "Password rejected",
    text: "The username or password was not accepted.",
  },
  "imap-off": {
    label: "IMAP is off",
    text: "Turn on IMAP for this account, then open Inbox again.",
  },
  browser: {
    label: "Browser sign-in",
    text: "Google wants a sign-in in the browser before this mailbox can be opened.",
  },
  reach: {
    label: "Host unreachable",
    text: "The mailbox host could not be reached.",
  },
  login: {
    label: "Sign-in missing",
    text: "Save a mailbox username and password to read older letters.",
  },
  send: {
    label: "Letter refused",
    text: "The host refused the letter.",
  },
} as const;

export type MailProblem = keyof typeof mailProblems;

export function isMailProblem(value: string): value is MailProblem {
  return Object.prototype.hasOwnProperty.call(mailProblems, value);
}

export function classifyMailError(error: unknown): MailProblem | "read" {
  const response =
    error && typeof error === "object" && "response" in error && typeof error.response === "string" ? error.response : "";
  const code = error && typeof error === "object" && "code" in error && (typeof error.code === "string" || typeof error.code === "number") ? String(error.code) : "";
  const message = error instanceof Error ? error.message : "";
  const blob = `${response}\n${message}\n${code}`;
  if (/invalid_grant|token has been expired or revoked/i.test(blob)) return "google";
  if (/application-specific password|invalidsecondfactor|5\.7\.9/i.test(blob)) return "second-factor";
  if (/imap (access )?is disabled|enable imap|imap is not enabled/i.test(blob)) return "imap-off";
  if (/web login required|log in via your web browser|log in with your web browser/i.test(blob)) return "browser";
  const authenticationFailed =
    error && typeof error === "object" && "authenticationFailed" in error && error.authenticationFailed === true;
  if (authenticationFailed || code === "EAUTH" || /invalid credentials|username and password not accepted|authentication failed|\b535\b/i.test(blob)) {
    return "password";
  }
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ESOCKET|EDNS|ECONNRESET|certificate|greeting timeout|connect timeout|timed out/i.test(blob)) {
    return "reach";
  }
  return "read";
}

export async function deliverMail(
  workspaceId: string,
  input: { to: string; subject: string; text: string },
): Promise<{ ok: true } | { ok: false; problem: MailProblem }> {
  const account = await mailDeliveryFor(workspaceId);
  if (!account) return { ok: false, problem: "login" };

  const ready = await mailTransport(account);
  if (!ready.ok) return ready;
  const transporter = ready.transport;

  try {
    await transporter.sendMail({
      from: account.fromAddress,
      to: input.to,
      subject: input.subject,
      text: input.text,
    });
    return { ok: true };
  } catch (error) {
    const problem = classifyMailError(error);
    console.error("letter refused", problem);
    return { ok: false, problem: problem === "read" ? "send" : problem };
  }
}

const RECENT = 80;
const NEW_PER_FOLDER = 40;
const SYNC_FRESH_MS = 60_000;

type SyncResult = { ok: true } | { ok: false; problem: MailProblem | "read" };

const syncedAt = new Map<string, number>();
const syncing = new Map<string, Promise<SyncResult>>();

export function shownMailProblem(problem: MailProblem | "read") {
  if (problem === "read") return null;
  return mailProblems[problem];
}

export function syncMailbox(workspaceId: string): Promise<SyncResult> {
  const at = syncedAt.get(workspaceId) ?? 0;
  if (Date.now() - at < SYNC_FRESH_MS) return Promise.resolve({ ok: true });
  const current = syncing.get(workspaceId);
  if (current) return current;
  const run = syncMailboxNow(workspaceId)
    .then((result) => {
      if (result.ok) syncedAt.set(workspaceId, Date.now());
      return result;
    })
    .finally(() => {
      syncing.delete(workspaceId);
    });
  syncing.set(workspaceId, run);
  return run;
}

async function syncMailboxNow(workspaceId: string): Promise<SyncResult> {
  try {
    const account = await mailDeliveryFor(workspaceId);
    if (!account) return { ok: true };
    if (!account.refreshToken && (!account.username || !account.password)) {
      return { ok: false, problem: "login" };
    }

    const client = await connectImap(account);
    if (!client.ok) return client;

    try {
      const boxes = await client.client.list();
      const inbox = boxes.find((box) => box.specialUse === "\\Inbox")?.path ?? "INBOX";
      const sent =
        boxes.find((box) => box.specialUse === "\\Sent")?.path ??
        boxes.find((box) => /(^|[/.])sent$/i.test(box.path) && !/draft/i.test(box.path))?.path ??
        null;
      const known = await knownExternalIds(workspaceId);
      const peopleByEmail = await peopleInBook(workspaceId);
      await pullFolder(client.client, inbox, "in", workspaceId, account.fromAddress, known, peopleByEmail);
      if (sent) {
        await pullFolder(client.client, sent, "out", workspaceId, account.fromAddress, known, peopleByEmail);
      }
      return { ok: true };
    } finally {
      try {
        await client.client.logout();
      } catch {
        /* The mailbox already closed. */
      }
    }
  } catch (error) {
    const problem = classifyMailError(error);
    console.error("mailbox sync failed", problem);
    return { ok: false, problem };
  }
}

function imapHosts(host: string) {
  const hosts = host.toLowerCase().startsWith("smtp.") ? [`imap.${host.slice(5)}`, host] : [host];
  return [...new Set(hosts)];
}

async function mailTransport(account: MailDelivery) {
  if (account.refreshToken) {
    const granted = await googleMailboxToken(account.refreshToken);
    if (!granted.ok) return granted;
    return {
      ok: true as const,
      transport: nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
          type: "OAuth2",
          user: account.username ?? "",
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          refreshToken: account.refreshToken,
          accessToken: granted.accessToken,
        },
      }),
    };
  }

  return {
    ok: true as const,
    transport: nodemailer.createTransport({
      host: account.host,
      port: account.port,
      secure: account.port === 465,
      auth: account.username ? { user: account.username, pass: account.password } : undefined,
    }),
  };
}

async function connectImap(account: MailDelivery) {
  if (account.refreshToken) return connectImapToken(account);
  let last: unknown;
  for (const host of imapHosts(account.host)) {
    const client = new ImapFlow({
      host,
      port: 993,
      secure: true,
      auth: { user: account.username ?? "", pass: account.password },
      logger: false,
      disableAutoIdle: true,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    });
    try {
      await client.connect();
      return { ok: true as const, client };
    } catch (error) {
      last = error;
      try {
        await client.logout();
      } catch {
        /* The attempt never opened. */
      }
      if (error && typeof error === "object" && "authenticationFailed" in error && error.authenticationFailed === true) break;
    }
  }
  const problem = classifyMailError(last);
  console.error("mailbox sync failed", problem);
  return { ok: false as const, problem };
}

async function connectImapToken(account: MailDelivery) {
  const granted = account.refreshToken ? await googleMailboxToken(account.refreshToken) : null;
  if (!granted?.ok || !account.username) return { ok: false as const, problem: granted && !granted.ok ? granted.problem : "google" };
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: account.username, accessToken: granted.accessToken },
    logger: false,
    disableAutoIdle: true,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
  try {
    await client.connect();
    return { ok: true as const, client };
  } catch (error) {
    try {
      await client.logout();
    } catch {
      /* The attempt never opened. */
    }
    const classified = classifyMailError(error);
    const problem = classified === "password" || classified === "second-factor" ? "google-scope" : classified;
    console.error("mailbox sync failed", problem);
    return { ok: false as const, problem };
  }
}

async function knownExternalIds(workspaceId: string) {
  const rows = await db
    .select({ externalId: messages.externalId })
    .from(messages)
    .where(eq(messages.workspaceId, workspaceId));
  return new Set(rows.flatMap((row) => (row.externalId ? [row.externalId] : [])));
}

async function peopleInBook(workspaceId: string) {
  const rows = await db
    .select({ id: people.id, email: people.email })
    .from(people)
    .where(eq(people.workspaceId, workspaceId));
  const byEmail = new Map<string, string>();
  for (const person of rows) {
    const address = emailAddress(person.email);
    if (address) byEmail.set(address, person.id);
  }
  return byEmail;
}

async function pullFolder(
  client: ImapFlow,
  path: string,
  direction: "in" | "out",
  workspaceId: string,
  ours: string,
  known: Set<string>,
  peopleByEmail: Map<string, string>,
) {
  let lock: { release: () => void } | null = null;
  try {
    lock = await client.getMailboxLock(path);
  } catch (error) {
    console.error("mailbox folder skipped", error instanceof Error ? error.message : "unknown");
    return;
  }

  try {
    const box = client.mailbox;
    if (!box || box.exists < 1) return;
    const start = Math.max(1, box.exists - (RECENT - 1));
    const listed = await client.fetchAll(`${start}:*`, { uid: true, envelope: true, internalDate: true });
    let stored = 0;
    for (const item of [...listed].reverse()) {
      if (stored >= NEW_PER_FOLDER) break;
      const envelope = item.envelope;
      const externalId = `${path}:${envelope?.messageId || item.uid}`;
      if (known.has(externalId)) continue;
      const full = await client.fetchOne(
        String(item.uid),
        { uid: true, source: { maxLength: 1_000_000 }, envelope: true, internalDate: true },
        { uid: true },
      );
      const saved = await storeLetter({
        workspaceId,
        direction,
        ours,
        externalId,
        envelope: full && full.envelope ? full.envelope : envelope,
        internalDate: full && full.internalDate ? full.internalDate : item.internalDate,
        source: full && full.source ? full.source : null,
        peopleByEmail,
      });
      if (saved) {
        known.add(externalId);
        stored += 1;
      }
    }
  } finally {
    lock.release();
  }
}

async function storeLetter(input: {
  workspaceId: string;
  direction: "in" | "out";
  ours: string;
  externalId: string;
  envelope: MessageEnvelopeObject | undefined;
  internalDate: Date | string | undefined;
  source: Buffer | null;
  peopleByEmail: Map<string, string>;
}) {
  let fromAddress = addressesOf(input.envelope?.from);
  let toAddress = [addressesOf(input.envelope?.to), addressesOf(input.envelope?.cc)].filter(Boolean).join(", ");
  let subject = (input.envelope?.subject || "(no subject)").slice(0, 500);
  let body = "";
  let when = messageDate(input.envelope?.date, input.internalDate);

  if (input.source) {
    try {
      const parsed = await simpleParser(input.source);
      fromAddress = headerText(parsed.from) || fromAddress;
      toAddress = [headerText(parsed.to), headerText(parsed.cc)].filter(Boolean).join(", ") || toAddress;
      subject = (parsed.subject || subject).slice(0, 500);
      body = (parsed.text || "").replace(/\u0000/g, "").slice(0, 20000);
      if (parsed.date) when = messageDate(parsed.date, when);
    } catch (error) {
      console.error("letter parse skipped", error instanceof Error ? error.message : "unknown");
    }
  }

  if (!fromAddress) fromAddress = input.direction === "out" ? input.ours : "(unknown)";
  if (!toAddress) toAddress = input.direction === "in" ? input.ours : "(unknown)";

  const personId = personForLetter(fromAddress, toAddress, input.ours, input.peopleByEmail);
  const linked = await linkExistingLetter(input.workspaceId, input.direction, input.externalId, toAddress, subject, when, personId);
  if (linked) return true;

  await db
    .insert(messages)
    .values({
      workspaceId: input.workspaceId,
      direction: input.direction,
      fromAddress,
      toAddress,
      subject,
      body,
      personId,
      delivered: input.direction === "out",
      externalId: input.externalId,
      createdAt: when,
    })
    .onConflictDoNothing({ target: [messages.workspaceId, messages.externalId] });
  return true;
}

async function linkExistingLetter(
  workspaceId: string,
  direction: "in" | "out",
  externalId: string,
  toAddress: string,
  subject: string,
  when: Date,
  personId: string | null,
) {
  if (direction !== "out") return false;
  const toEmail = emailsIn(toAddress)[0];
  if (!toEmail) return false;
  const [existing] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(
      and(
        eq(messages.workspaceId, workspaceId),
        eq(messages.direction, "out"),
        eq(messages.subject, subject),
        isNull(messages.externalId),
        sql`position(${toEmail} in lower(${messages.toAddress})) > 0`,
        sql`abs(extract(epoch from (${messages.createdAt} - ${when}::timestamptz))) < 600`,
      ),
    )
    .limit(1);
  if (!existing) return false;
  await db
    .update(messages)
    .set({ externalId, delivered: true, ...(personId ? { personId } : {}) })
    .where(eq(messages.id, existing.id));
  return true;
}

function personForLetter(fromAddress: string, toAddress: string, ours: string, peopleByEmail: Map<string, string>) {
  const own = emailAddress(ours);
  const candidates = [...emailsIn(fromAddress), ...emailsIn(toAddress)].filter((address) => address !== own);
  for (const address of candidates) {
    const personId = peopleByEmail.get(address);
    if (personId) return personId;
  }
  return null;
}

function emailsIn(value: string) {
  return (value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []).map((address) => address.toLowerCase());
}

function addressesOf(list: MessageEnvelopeObject["from"]) {
  return (list ?? [])
    .flatMap((item) => (item.address ? [item.name ? `${item.name} <${item.address}>` : item.address] : []))
    .join(", ");
}

function headerText(value: { text?: string } | Array<{ text?: string }> | undefined) {
  if (!value) return "";
  const list = Array.isArray(value) ? value : [value];
  return list
    .map((item) => item.text ?? "")
    .filter(Boolean)
    .join(", ");
}

function messageDate(value: Date | string | undefined, fallback: Date | string | undefined) {
  const candidate = value ?? fallback;
  const date = candidate instanceof Date ? candidate : candidate ? new Date(candidate) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}
