import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicNav, publicFeatures, type FeatureSlug } from "@/components/public-nav";
import { buttonClass } from "@/components/ui";
import { agentScopes, sequences } from "@/lib/placeholders";
import { ONBOARDING_STEPS, PIPELINES } from "@/lib/pipelines";

const copy: Record<FeatureSlug, { title: string; lede: string; body: string }> = {
  sales: {
    title: "Sales",
    lede: "Move a card when the conversation moves.",
    body: "The sale lives on one board. A person starts in New, and the card walks through Talking and Proposal until it is Won or Lost. The card keeps who they are, the organization they belong to, and what the work is worth.",
  },
  onboarding: {
    title: "Onboarding",
    lede: "After the yes, the work of getting them steady.",
    body: "A won sale does not leave the book. It moves to a second board, from Welcome through Setup and a first win, until the client is Steady. Three checks ride with the card so nothing promised gets dropped.",
  },
  automations: {
    title: "Automations",
    lede: "Email that sends itself, when a stage changes or a day arrives.",
    body: "Some notes go because a card moved: the first conversation, the day someone is won, a week of quiet. Others wait a set number of days and then follow. A timed series is only one kind. All of it leaves from the workspace’s own address.",
  },
  mcp: {
    title: "MCP",
    lede: "An assistant that can read the book and move a card.",
    body: "MusterLog speaks MCP. Point an assistant at this workspace and it can read the people, read the organizations, advance a card one stage, and leave a note in your name. It only sees this book.",
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

export default async function FeaturePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isFeatureSlug(slug)) notFound();
  const feature = copy[slug];

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
      <section className="mx-auto flex w-full max-w-6xl flex-col items-start gap-8 px-6 py-10 sm:px-10">
        <div className="max-w-md">
          <p className="font-sign text-[2rem] leading-[1.05] tracking-[-0.035em]">{feature.lede}</p>
          <p className="mt-4 text-sm leading-6 text-muted">{feature.body}</p>
        </div>
        <Showcase slug={slug} />
        <div>
          <p className="text-sm text-muted">Log in to open this in the book.</p>
          <Link href="/" className={`${buttonClass} mt-4 inline-block`}>
            Log in
          </Link>
        </div>
      </section>
    </main>
  );
}

function whenLabel(audience: string) {
  if (audience.startsWith("Quiet")) return `someone has been ${audience.toLowerCase()}`;
  const stage = audience.split("·").at(-1)?.trim();
  return stage ? `a card reaches ${stage}` : audience;
}

function Showcase({ slug }: { slug: FeatureSlug }) {
  if (slug === "sales" || slug === "onboarding") {
    const pipeline = PIPELINES.find((item) => item.kind === slug);
    if (!pipeline) return null;
    return (
      <div className="w-full max-w-3xl">
        <ol className="flex flex-wrap gap-2">
          {pipeline.stages.map((stage, index) => (
            <li key={stage.name} className="border border-sign px-3 py-2 text-sm">
              <span className="mr-2 font-mono text-[11px] text-muted">{String(index + 1).padStart(2, "0")}</span>
              {stage.name}
            </li>
          ))}
        </ol>
        {slug === "onboarding" ? (
          <ul className="mt-6 max-w-sm divide-y divide-line border-y border-line">
            {ONBOARDING_STEPS.map((step) => (
              <li key={step} className="py-3 text-sm">
                {step}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  if (slug === "automations") {
    return (
      <ul className="w-full max-w-xl divide-y divide-line border-y border-line">
        {sequences.map((sequence) => (
          <li key={sequence.slug} className="py-4">
            <p className="font-sign text-2xl leading-none tracking-[-0.03em]">{sequence.name}</p>
            <p className="mt-2 text-sm text-muted">When {whenLabel(sequence.audience)}</p>
            <p className="mt-2 font-mono text-[11px] text-muted">
              Then {sequence.steps.map((step) => `day ${step.day}`).join(", ")}
            </p>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="w-full max-w-xl divide-y divide-line border-y border-line">
      {agentScopes.map((scope) => (
        <li key={scope.id} className="grid gap-1 py-3 sm:grid-cols-[14rem_1fr]">
          <span>{scope.label}</span>
          <span className="text-sm text-muted">{scope.detail}</span>
        </li>
      ))}
    </ul>
  );
}
