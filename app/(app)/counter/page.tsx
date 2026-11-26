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
      <PageHeader title="Home" lede={`${counter.months.current} beside ${counter.months.previous}, and the deals that have gone quiet.`} />
      <div className="grid gap-4 lg:grid-cols-2">
        <MonthCompare
          href="/sales"
          label="New deals"
          current={counter.fresh.current}
          previous={counter.fresh.previous}
          currentName={counter.months.current}
          previousName={counter.months.previous}
          format={(value) => String(value)}
        />
        <MonthCompare
          href="/sales"
          label="Deal value"
          current={counter.freshValue.current}
          previous={counter.freshValue.previous}
          currentName={counter.months.current}
          previousName={counter.months.previous}
          format={(value) => money(value)}
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
    </div>
  );
}

function MonthCompare({
  href,
  label,
  current,
  previous,
  currentName,
  previousName,
  format,
}: {
  href: string;
  label: string;
  current: number;
  previous: number;
  currentName: string;
  previousName: string;
  format: (value: number) => string;
}) {
  const max = Math.max(current, previous, 1);
  const beside = current === previous ? `Same as ${previousName}.` : `${previousName} was ${format(previous)}.`;

  return (
    <Link href={href} className="block border border-line bg-paper p-5 hover:border-ink">
      <p className="font-mono text-[11px] text-muted">{label}</p>
      <p className="mt-3 font-sign text-5xl leading-none tracking-[-0.04em]">{format(current)}</p>
      <p className="mt-2 text-sm text-muted">{beside}</p>
      <div className="mt-6 space-y-3">
        <MonthBar name={currentName} value={format(current)} width={(current / max) * 100} current />
        <MonthBar name={previousName} value={format(previous)} width={(previous / max) * 100} />
      </div>
    </Link>
  );
}

function MonthBar({ name, value, width, current }: { name: string; value: string; width: number; current?: boolean }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
        <span className={current ? "text-ink" : "text-muted"}>{name}</span>
        <span className="font-mono text-xs text-muted">{value}</span>
      </div>
      <div className="h-2 bg-paper-2">
        <div className={`h-full ${current ? "bg-ink" : "bg-line"}`} style={{ width: `${Math.max(width, width > 0 ? 4 : 0)}%` }} />
      </div>
    </div>
  );
}
