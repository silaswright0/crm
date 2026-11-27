import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { PublicNav, publicFeatures, type FeatureSlug } from "@/components/public-nav";
import { buttonClass } from "@/components/ui";
import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const premium = new Set<FeatureSlug>(["mail", "automations", "mcp"]);

const copy: Record<FeatureSlug, { title: string; lede: string; body: string }> = {
  crm: {
    title: "CRM",
    lede: "See the deal that stalled, before it goes cold.",
    body: "A pipeline only helps if a stuck deal is obvious. Use MusterLog to manage leads by categorizing into stages and documenting next steps. MusterLog will track when the deal moves forward and remind you when it doesn't.",
  },
  mail: {
    title: "Mail",
    lede: "Write the follow-up where the deal already lives.",
    body: "Manage your leads and mail from one spot. MusterLog will keep track of your recent communication, and enable you to respond to clients from the same place you manage them.",
  },
  automations: {
    title: "Automations",
    lede: "Automate email campaigns based on deal stages and webhooks.",
    body: "MusterLog allows for greater hands-free sales and CRM management. Configure automated emails for sales or onboarding when deals move to the next step, or further customize these automations with webhooks.",
  },
  mcp: {
    title: "MCP",
    lede: "Ask an assistant to manage deals, mail, and automations.",
    body: "MusterLog provides an MCP server that lets an AI agent work in the same book you use. It can move a deal, record the next step, reply to a client, and much more.",
  },
};

function isFeatureSlug(slug: string): slug is FeatureSlug {
  return publicFeatures.some((feature) => feature.slug === slug);
}

export function generateStaticParams() {
  return publicFeatures.map((feature) => ({ slug: feature.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (!isFeatureSlug(slug)) return { title: "MusterLog" };
  const feature = copy[slug];
  return { title: `${feature.title} · MusterLog`, description: feature.lede };
}

async function onProPlan() {
  const session = await auth();
  const workspaceId = session?.user?.workspaceId;
  if (!workspaceId) return false;
  const [workspace] = await db
    .select({ plan: workspaces.plan })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId));
  return workspace?.plan === "pro";
}

export default async function FeaturePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isFeatureSlug(slug)) notFound();
  const feature = copy[slug];
  const showPro = premium.has(slug) && !(await onProPlan());

  return (
    <main className="flex min-h-dvh flex-col bg-paper">
      <section className="bg-sign text-paper">
        <div className="mx-auto flex max-w-6xl items-start justify-between gap-6 px-6 pt-6 sm:px-10">
          <Link href="/" className="font-mono text-[11px] text-sign-muted hover:text-paper">
            MusterLog
          </Link>
          <PublicNav current={slug} />
        </div>
        <h1 className="mx-auto max-w-6xl px-6 pb-16 pt-8 font-sign text-[clamp(4.5rem,14vw,9rem)] leading-[0.76] tracking-[-0.06em] sm:px-10">
          {feature.title}
        </h1>
      </section>
      <section className="mx-auto flex w-full max-w-6xl flex-col items-start gap-10 px-6 py-10 sm:px-10">
        <div className="max-w-lg">
          <p className="font-sign text-[2rem] leading-[1.05] tracking-[-0.035em]">{feature.lede}</p>
          <p className="mt-4 text-sm leading-6 text-muted">{feature.body}</p>
          {showPro ? (
            <p className="mt-4 border-l-4 border-lacquer pl-4 text-sm leading-6">
              This is a premium feature and requires a Pro plan.
            </p>
          ) : null}
        </div>
        <Link href="/" className={`${buttonClass} inline-block`}>
          Log in
        </Link>
      </section>
    </main>
  );
}
