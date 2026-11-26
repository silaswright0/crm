import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicNav, publicFeatures, type FeatureSlug } from "@/components/public-nav";
import { buttonClass } from "@/components/ui";
import { automationExamples, mcpTools } from "@/lib/desk";
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
  crm: {
    title: "CRM",
    lede: "One book for the people you are selling, and the ones you just won.",
    body: "People and organizations live here. A person can hold a next step, a comment, and a card on Sales or Onboarding. Home sets this month beside last month, and lists the open deals that have gone quiet. The book is on Free.",
  },
  mail: {
    title: "Mail",
    lede: "Write from the book. The letter leaves when a host is saved.",
    body: "Inbox, Sent, and a page to write. The host and the from-address are saved on the book in Config. Mail is a Pro feature. Free can look. Until a host is saved, a letter stays in Sent.",
  },
  automations: {
    title: "Automations",
    lede: "An email when a card reaches a stage, or when another system calls.",
    body: "A rule is one letter. It can leave when a sales or onboarding card enters a stage, after a wait of a few days. Or it can leave when a webhook arrives, carrying the person to write to. Automations are a Pro feature. Free can look. Only Pro can save a rule.",
  },
  mcp: {
    title: "MCP",
    lede: "An assistant that can run this book, and no other.",
    body: "MusterLog will speak MCP. The assistant can list and change people, organizations, cards, notes, and next steps. It cannot see another workspace, and it does not send the mail. MCP is a Pro feature. The door stays shut on Free.",
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

  if (slug === "crm") {
    const lines = [
      ["Home", "This month beside last month, and the quiet deals."],
      ["People", "A name, a way to reach them, and the organization they belong to."],
      ["Organizations", "The shop or company, and the people on it."],
      ["The card", "A next step, a comment, and the stage it sits on."],
    ];
    return (
      <ul className="w-full max-w-xl divide-y divide-line border-y border-line">
        {lines.map(([name, detail]) => (
          <li key={name} className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr]">
            <span className="font-sign text-2xl leading-none tracking-[-0.03em]">{name}</span>
            <span className="text-sm text-muted">{detail}</span>
          </li>
        ))}
      </ul>
    );
  }

  if (slug === "mail") {
    const lines = [
      ["Inbox", "Letters that arrived for this book."],
      ["Sent", "Letters you wrote. They stay here until a host can take them."],
      ["Write", "A letter to someone on the book."],
      ["Config", "The host, the port, and the address it leaves from."],
    ];
    return (
      <ul className="w-full max-w-xl divide-y divide-line border-y border-line">
        {lines.map(([name, detail]) => (
          <li key={name} className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr]">
            <span className="font-sign text-2xl leading-none tracking-[-0.03em]">{name}</span>
            <span className="text-sm text-muted">{detail}</span>
          </li>
        ))}
      </ul>
    );
  }

  if (slug === "automations") {
    return (
      <ul className="w-full max-w-xl divide-y divide-line border-y border-line">
        {automationExamples.map((example) => (
          <li key={example.name} className="py-4">
            <p className="font-sign text-2xl leading-none tracking-[-0.03em]">{example.name}</p>
            <p className="mt-2 text-sm">{example.when}</p>
            <p className="mt-1 text-sm text-muted">{example.then}</p>
          </li>
        ))}
      </ul>
    );
  }

  const groups = [...new Set(mcpTools.map((tool) => tool.group))];
  return (
    <div className="w-full max-w-xl">
      {groups.map((group) => (
        <section key={group} className="mt-6 first:mt-0">
          <h2 className="font-mono text-[11px] text-muted">{group}</h2>
          <ul className="mt-2 divide-y divide-line border-y border-line">
            {mcpTools
              .filter((tool) => tool.group === group)
              .map((tool) => (
                <li key={tool.name} className="grid gap-1 py-3 sm:grid-cols-[14rem_1fr]">
                  <span className="font-mono text-sm">{tool.name}</span>
                  <span className="text-sm text-muted">{tool.detail}</span>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
