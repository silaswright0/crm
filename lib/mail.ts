import nodemailer from "nodemailer";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { mailAccounts } from "@/lib/db/schema";

export type MailDelivery = {
  host: string;
  port: number;
  username: string | null;
  password: string;
  fromAddress: string;
};

export async function mailDeliveryFor(workspaceId: string): Promise<MailDelivery | null> {
  const [row] = await db.select().from(mailAccounts).where(eq(mailAccounts.workspaceId, workspaceId));
  if (row?.host && row.fromAddress) {
    return {
      host: row.host,
      port: row.port,
      username: row.username,
      password: row.password,
      fromAddress: row.fromAddress,
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
  };
}

export async function deliverMail(workspaceId: string, input: { to: string; subject: string; text: string }) {
  const account = await mailDeliveryFor(workspaceId);
  if (!account) return false;

  const transporter = nodemailer.createTransport({
    host: account.host,
    port: account.port,
    secure: account.port === 465,
    auth: account.username ? { user: account.username, pass: account.password } : undefined,
  });

  await transporter.sendMail({
    from: account.fromAddress,
    to: input.to,
    subject: input.subject,
    text: input.text,
  });
  return true;
}
