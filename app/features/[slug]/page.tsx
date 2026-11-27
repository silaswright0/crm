import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicNav, publicFeatures, type FeatureSlug } from "@/components/public-nav";
import { buttonClass } from "@/components/ui";
import { automationExamples } from "@/lib/desk";

const copy: Record<FeatureSlug, { title: string; lede: string; body: string; points: [string, string][] }> = {
  crm: {
    title: "CRM",
    lede: "See the deal that stalled, before it goes cold.",
    body: "A pipeline only helps if a stuck deal is obvious. Home sets this month beside last month, then lists the open deals that have been still for seven days. The person, the company, and the card stay on one book. You move the card when the conversation moves.",
    points: [
      ["Quiet deals", "Seven days with no update, and no letter the server accepted. The deal is listed, with its stage and value."],
      ["This month", "New deals and what they are worth, next to last month."],
      ["People", "Name, email, last touch, and the organization they belong to."],
      ["Two boards", "The sale, then the work after the yes. Add, rename, or remove the open columns."],
      ["The card", "A comment, a value, a next step, and the stage it is on."],
    ],
  },
  mail: {
    title: "Mail",
    lede: "Write the follow-up where the deal already lives.",
    body: "Other inboxes keep the letter away from the card. Here you write to someone on the book. The page is the host setup until a server is saved, so a draft cannot look like it was sent. Sent means that server accepted the letter. That is the touch that clears Quiet.",
    points: [
      ["On the card", "The person and their address are already in the book."],
      ["Host first", "Inbox, Sent, and Write open after the host, port, and from-address are saved."],
      ["Accepted", "The letter is stored in Sent only when the mail server takes it."],
      ["Clears Quiet", "A letter that left resets the seven quiet days on that person and their open deal."],
    ],
  },
  automations: {
    title: "Automations",
    lede: "The follow-up leaves when the card reaches the stage.",
    body: "A first conversation and a yes both need a letter, and both are easy to forget. One rule holds one letter. It sends when a card enters a stage, that day or a few days later. A form on your site can send the same way, to the address in the call.",
    points: [
      ["Stage", "Talking, Welcome, or any column you keep. The letter leaves when the card arrives."],
      ["Wait", "The same day, or as many as ninety days later."],
      ["Webhook", "Your site calls the book and names who to write."],
      ["One letter", "One subject, one body. Every rule stays visible on the desk."],
    ],
  },
  mcp: {
    title: "MCP",
    lede: "Ask an assistant to run this book while you stay in the work.",
    body: "The assistant can find a person, move a deal, write the note, save a mail host, send a letter, and set a follow-up rule. It stays in this workspace. A letter is stored only after the mail server accepts it.",
    points: [
      ["People and companies", "Find them, add one, or change how you reach them."],
      ["Deals", "Open a card, move it, change the value, or take it off the board."],
      ["Mail", "Save the host, read Sent and Inbox, and send a letter."],
      ["Automations", "Save a stage rule or a webhook rule, or remove one."],
    ],
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
      <section className="mx-auto flex w-full max-w-6xl flex-col items-start gap-10 px-6 py-10 sm:px-10">
        <div className="max-w-lg">
          <p className="font-sign text-[2rem] leading-[1.05] tracking-[-0.035em]">{feature.lede}</p>
          <p className="mt-4 text-sm leading-6 text-muted">{feature.body}</p>
        </div>
        <ul className="w-full max-w-xl divide-y divide-line border-y border-line">
          {feature.points.map(([name, detail]) => (
            <li key={name} className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr] sm:items-baseline">
              <span className="font-sign text-2xl leading-none tracking-[-0.03em]">{name}</span>
              <span className="text-sm leading-6 text-muted">{detail}</span>
            </li>
          ))}
        </ul>
        {slug === "automations" ? (
          <ul className="w-full max-w-xl divide-y divide-line border-y border-line">
            {automationExamples.map((example) => (
              <li key={example.name} className="py-4">
                <p className="font-sign text-2xl leading-none tracking-[-0.03em]">{example.name}</p>
                <p className="mt-2 text-sm">{example.when}</p>
                <p className="mt-1 text-sm text-muted">{example.then}</p>
              </li>
            ))}
          </ul>
        ) : null}
        <Link href="/" className={`${buttonClass} inline-block`}>
          Log in
        </Link>
      </section>
    </main>
  );
}
