import Link from "next/link";
import { notFound } from "next/navigation";
import { holdPlaceholder } from "@/lib/actions";
import { sequenceBySlug } from "@/lib/placeholders";
import { requireWorkspace } from "@/lib/session";
import { DeskGate } from "@/components/desk";
import { buttonClass, ghostClass } from "@/components/ui";

export default async function SequencePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { workspace } = await requireWorkspace();
  const { slug } = await params;
  const query = await searchParams;
  const sequence = sequenceBySlug(slug);
  if (!sequence) notFound();

  const locked = workspace.plan !== "desk";
  const back = `/mail/${sequence.slug}`;

  return (
    <div>
      <Link href="/mail" className="text-[11px] uppercase tracking-[0.14em] text-muted hover:text-ink">
        Mail
      </Link>
      <h1 className="mt-3 font-sign text-4xl tracking-tight sm:text-5xl">{sequence.name}</h1>
      <p className="mt-2 text-sm text-muted">
        {sequence.audience} · {sequence.status}
      </p>
      <div className="mt-6">
        <DeskGate locked={locked} notice={query.notice}>
          <ol className="space-y-4">
            {sequence.steps.map((step, index) => (
              <li key={step.subject} className="border border-line bg-paper-2 p-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted">
                  Step {index + 1} · day {step.day}
                </p>
                <p className="mt-2 font-sign text-2xl">{step.subject}</p>
                <p className="mt-2 max-w-xl text-sm leading-6">{step.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-wrap gap-2">
            <PlaceholderButton locked={locked} to={back} label="Send" primary />
            <PlaceholderButton locked={locked} to={back} label="Enroll" />
            <PlaceholderButton locked={locked} to={back} label="Connect a sender" />
          </div>
        </DeskGate>
      </div>
    </div>
  );
}

function PlaceholderButton({
  locked,
  to,
  label,
  primary,
}: {
  locked: boolean;
  to: string;
  label: string;
  primary?: boolean;
}) {
  if (locked) {
    return (
      <button type="button" disabled className={primary ? buttonClass : ghostClass}>
        {label}
      </button>
    );
  }

  return (
    <form action={holdPlaceholder}>
      <input type="hidden" name="to" value={to} />
      <button type="submit" className={primary ? buttonClass : ghostClass}>
        {label}
      </button>
    </form>
  );
}
