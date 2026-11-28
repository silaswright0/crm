import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { automations, people, scheduledSends, workspaces } from "@/lib/db/schema";
import { emailAddress } from "@/lib/format";
import { deliverMail, mailProblems } from "@/lib/mail";

const HOUR_MS = 60 * 60 * 1000;
const RETRIES = 24;

type DueSend = {
  id: string;
  workspace_id: string;
  to_address: string;
  subject: string;
  body: string;
  attempts: number;
};

export async function enqueueStageLetters(workspaceId: string, personId: string | null, stageId: string) {
  if (!personId) return;
  const [person] = await db
    .select({ email: people.email })
    .from(people)
    .where(and(eq(people.id, personId), eq(people.workspaceId, workspaceId)));
  const email = emailAddress(person?.email);
  if (!email) return;

  const rules = await db
    .select()
    .from(automations)
    .where(and(eq(automations.workspaceId, workspaceId), eq(automations.triggerKind, "stage"), eq(automations.stageId, stageId)));
  if (rules.length === 0) return;

  await db.insert(scheduledSends).values(
    rules.map((rule) => ({
      workspaceId,
      automationId: rule.id,
      toAddress: email,
      subject: rule.subject,
      body: rule.body,
      dueAt: dueAfterHours(rule.delayHours),
    })),
  );
}

export async function enqueueWebhook(token: string, emailRaw: string) {
  const email = emailAddress(emailRaw);
  if (!email) return { ok: false as const, status: 400, error: "An email is required." };

  const [row] = await db
    .select({ rule: automations, plan: workspaces.plan })
    .from(automations)
    .innerJoin(workspaces, eq(automations.workspaceId, workspaces.id))
    .where(and(eq(automations.webhookToken, token), eq(automations.triggerKind, "webhook")));
  if (!row) return { ok: false as const, status: 404, error: "That webhook is not on a book." };
  if (row.plan !== "pro") return { ok: false as const, status: 403, error: "This book is not on Pro." };

  const dueAt = dueAfterHours(row.rule.delayHours);
  await db.insert(scheduledSends).values({
    workspaceId: row.rule.workspaceId,
    automationId: row.rule.id,
    toAddress: email,
    subject: row.rule.subject,
    body: row.rule.body,
    dueAt,
  });
  return { ok: true as const, dueAt: dueAt.toISOString() };
}

export function startSchedule() {
  const flag = globalThis as { musterSchedule?: boolean };
  if (flag.musterSchedule) return;
  flag.musterSchedule = true;
  void dispatchDueLetters();
  setInterval(() => {
    void dispatchDueLetters();
  }, HOUR_MS);
}

export async function dispatchDueLetters() {
  for (let batch = 0; batch < 25; batch += 1) {
    const claimed = rowsOf(
      await db.execute(sql`
        update scheduled_sends
        set claimed_at = now()
        where id in (
          select id from scheduled_sends
          where sent_at is null
            and abandoned_at is null
            and due_at <= now()
            and (claimed_at is null or claimed_at < now() - interval '2 hours')
          order by due_at
          limit 20
          for update skip locked
        )
        returning id, workspace_id, to_address, subject, body, attempts
      `),
    );
    if (claimed.length === 0) return;
    for (const send of claimed) {
      await deliverScheduled(send);
    }
    if (claimed.length < 20) return;
  }
}

async function deliverScheduled(send: DueSend) {
  try {
    const result = await deliverMail(send.workspace_id, {
      to: send.to_address,
      subject: send.subject,
      text: send.body,
    });
    if (result.ok) {
      await db
        .update(scheduledSends)
        .set({ sentAt: new Date(), claimedAt: null, lastError: null })
        .where(eq(scheduledSends.id, send.id));
      return;
    }
    const attempts = send.attempts + 1;
    const reason = mailProblems[result.problem].text;
    await db
      .update(scheduledSends)
      .set({
        attempts,
        claimedAt: null,
        lastError: reason,
        abandonedAt: attempts >= RETRIES ? new Date() : null,
      })
      .where(eq(scheduledSends.id, send.id));
  } catch (error) {
    console.error("scheduled letter failed", error instanceof Error ? error.message : "unknown");
    await db
      .update(scheduledSends)
      .set({ claimedAt: null, lastError: "The letter was refused." })
      .where(eq(scheduledSends.id, send.id));
  }
}

function dueAfterHours(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function rowsOf(result: unknown): DueSend[] {
  if (Array.isArray(result)) return result as DueSend[];
  if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) {
    return result.rows as DueSend[];
  }
  return [];
}
