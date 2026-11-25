import Link from "next/link";
import { getCounter } from "@/lib/db/queries";
import { money } from "@/lib/format";
import { requireWorkspace } from "@/lib/session";
import { PageHeader, QuietMark } from "@/components/ui";

export default async function CounterPage() {
  const { workspace } = await requireWorkspace();
  const counter = await getCounter(workspace.id);

  return (
    <div>
      <PageHeader title="The Counter" lede="Open deals, the ones that have gone quiet, and what is due." />
      <div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
        <Metric href="/sales" label="Open deals" value={String(counter.open.count)} detail={money(counter.open.valueCents)} />
        <Metric
          href="#quiet-deals"
          label="Quiet deals"
          value={String(counter.quietDeals.count)}
          detail={money(counter.quietDeals.valueCents)}
          tone="quiet"
        />
        <Metric href="/sales" label="Won" value={String(counter.won.count)} detail={money(counter.won.valueCents)} />
        <Metric
          href="/onboarding"
          label="Onboarding"
          value={String(counter.onboarding.count)}
          detail={`${counter.onboarding.quiet} quiet`}
        />
      </div>

      <section id="quiet-deals" className="mt-10">
        <h2 className="font-sign text-2xl tracking-[-0.03em]">Quiet deals</h2>
        {counter.quietDeals.rows.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No open deal has been quiet for 7 days.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {counter.quietDeals.rows.map((deal) => (
              <li key={deal.id}>
                <Link href={deal.href} className="flex items-center justify-between gap-4 bg-quiet py-3 hover:text-lacquer">
                  <span>
                    <span className="block">{deal.title}</span>
                    <span className="mt-1 block text-sm text-muted">
                      {deal.organizationName}
                      {deal.stageName ? ` · ${deal.stageName}` : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-mono text-sm text-lacquer">{money(deal.valueCents)}</span>
                    <QuietMark />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="due" className="mt-10">
        <h2 className="font-sign text-2xl tracking-[-0.03em]">Due · {counter.due.length}</h2>
        {counter.due.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Nothing is due.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {counter.due.map((step) => (
              <li key={`${step.href}-${step.detail}`}>
                <Link href={step.href} className="flex items-center justify-between gap-4 py-3 hover:text-lacquer">
                  <span>
                    <span className="block">{step.title}</span>
                    <span className="mt-1 block text-sm text-muted">{step.detail}</span>
                  </span>
                  {step.tone === "quiet" ? <QuietMark /> : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Metric({
  href,
  label,
  value,
  detail,
  tone,
}: {
  href: string;
  label: string;
  value: string;
  detail: string;
  tone?: "quiet";
}) {
  return (
    <Link href={href} className={`block p-5 hover:text-lacquer ${tone === "quiet" ? "bg-quiet" : "bg-paper"}`}>
      <p className={`font-mono text-[11px] ${tone === "quiet" ? "text-quiet-ink" : "text-muted"}`}>{label}</p>
      <p className="mt-3 font-sign text-5xl leading-none tracking-[-0.04em]">{value}</p>
      <p className="mt-3 font-mono text-xs text-muted">{detail}</p>
    </Link>
  );
}
