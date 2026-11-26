import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicNav, publicFeatures, type FeatureSlug } from "@/components/public-nav";
import { buttonClass } from "@/components/ui";
import { automationExamples, mcpTools } from "@/lib/desk";

const copy: Record<FeatureSlug, { title: string; lede: string; body: string; plan: string }> = {
  home: {
    title: "Home",
    lede: "This month beside last month, and the deals that have gone quiet.",
    body: "Home counts the new deals opened this month, and what they are worth, set next to last month. Under that, the open deals that have been still for seven days. A deal stays quiet until the card is updated, a letter to them is accepted by the mail server, or a letter arrives from their address.",
    plan: "On every book.",
  },
  book: {
    title: "Book",
    lede: "The people, the organizations, and the cards they sit on.",
    body: "A person keeps a name, a way to reach them, and the day they were last touched. An organization keeps the people on it. A card keeps a comment, a next step, and a value. The boards start with a few columns. Add, rename, or remove the open ones. Won, Lost, and Steady stay at the end.",
    plan: "On every book.",
  },
  mail: {
    title: "Mail",
    lede: "A letter leaves only after the server takes it.",
    body: "Open Mail with no host and the page is the setup. Save the host, the port, and the from-address, and Inbox, Sent, and Write open. A letter is stored in Sent when the server accepts it. That letter, or one that arrives from their address, clears Quiet for seven days.",
    plan: "Pro. Free can look.",
  },
  automations: {
    title: "Automations",
    lede: "One rule. One letter. A stage, or a call from outside.",
    body: "A rule sends when a card enters a stage, the same day or a few days later. Or it sends when a webhook arrives, to the address in the request. Each rule is one letter. Free can read the desk. Only Pro can save a rule.",
    plan: "Pro. Free can look.",
  },
  mcp: {
    title: "MCP",
    lede: "An assistant for this book, and no other.",
    body: "The assistant can list and change people, organizations, cards, notes, and next steps. It stays inside one workspace, and it does not send mail. The door is drawn. The server that answers it is the next build. Free can see the tools. Pro opens the door.",
    plan: "Pro. The server is the next build.",
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
          <p className="mt-4 font-mono text-[11px] text-muted">{feature.plan}</p>
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

function LineList({ lines }: { lines: [string, string][] }) {
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

function Showcase({ slug }: { slug: FeatureSlug }) {
  if (slug === "home") {
    return (
      <div className="w-full max-w-xl">
        <div className="grid gap-4 sm:grid-cols-2">
          <figure className="border border-line p-5">
            <figcaption className="font-mono text-[11px] text-muted">New deals</figcaption>
            <p className="mt-3 font-sign text-5xl leading-none tracking-[-0.04em]">4</p>
            <p className="mt-2 text-sm text-muted">Last month was 2.</p>
          </figure>
          <figure className="border border-line p-5">
            <figcaption className="font-mono text-[11px] text-muted">Deal value</figcaption>
            <p className="mt-3 font-sign text-5xl leading-none tracking-[-0.04em]">$18,000</p>
            <p className="mt-2 text-sm text-muted">Last month was $9,000.</p>
          </figure>
        </div>
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {[
            ["North Glass", "Talking", "$12,000"],
            ["Harbor & Rye", "Proposal", "$6,400"],
          ].map(([name, stage, value]) => (
            <li key={name} className="flex items-center justify-between gap-4 bg-quiet py-3">
              <span>
                <span className="block text-sm">{name}</span>
                <span className="mt-1 block text-sm text-muted">{stage}</span>
              </span>
              <span className="font-mono text-sm text-lacquer">{value}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (slug === "book") {
    return (
      <LineList
        lines={[
          ["People", "A name, how to reach them, and the day of the last touch."],
          ["Organizations", "The shop or company, and the people on it."],
          ["The card", "A comment, a next step, and what the work is worth."],
          ["Columns", "Start with a few. Add, rename, or remove the open ones."],
        ]}
      />
    );
  }

  if (slug === "mail") {
    return (
      <LineList
        lines={[
          ["Host", "Saved before Inbox, Sent, or Write will open."],
          ["Write", "A letter to someone on the book."],
          ["Sent", "Stored once the mail server accepts it."],
          ["Quiet", "A letter that left, or one that arrived from them, clears the seven days."],
        ]}
      />
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
