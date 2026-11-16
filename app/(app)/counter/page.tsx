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
      <PageHeader
        title="The Counter"
        lede="Who needs a touch, and where the work is sitting."
      />
      <section>
        <h2 className="font-sign text-2xl tracking-[-0.03em]">Touches due</h2>
        {counter.touches.length === 0 ? (
          <p className="mt-4 font-sign text-3xl tracking-[-0.03em]">The counter is clear.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {counter.touches.map((touch) => (
              <li key={`${touch.href}-${touch.detail}`}>
                <Link href={touch.href} className="flex items-center justify-between gap-4 py-3 hover:text-lacquer">
                  <span>
                    <span className="block">{touch.title}</span>
                    <span className="mt-1 block text-sm text-muted">{touch.detail}</span>
                  </span>
                  {touch.tone === "quiet" ? <QuietMark /> : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <StageStrip
          title="Sales"
          rows={counter.sales.map((stage) => ({
            id: stage.id,
            href: stage.href,
            name: stage.name,
            aside: `${stage.count} · ${money(stage.valueCents)}`,
            calm: stage.kind === "won",
          }))}
        />
        <StageStrip
          title="Onboarding"
          rows={counter.onboarding.map((stage) => ({
            id: stage.id,
            href: stage.href,
            name: stage.name,
            aside: `${stage.count} · ${stage.stuck} stuck`,
            calm: stage.kind === "done",
          }))}
        />
      </div>
    </div>
  );
}

function StageStrip({
  title,
  rows,
}: {
  title: string;
  rows: { id: string; href: string; name: string; aside: string; calm: boolean }[];
}) {
  return (
    <section>
      <h2 className="font-sign text-2xl tracking-[-0.03em]">{title}</h2>
      <ul className="mt-3 divide-y divide-line border-y border-line">
        {rows.map((row, index) => (
          <li key={row.id}>
            <Link href={row.href} className="flex items-baseline gap-4 py-3 hover:text-lacquer">
              <span className="w-6 font-mono text-xs text-muted">{String(index + 1).padStart(2, "0")}</span>
              <span className="flex-1">{row.name}</span>
              <span className={`font-mono text-xs ${row.calm ? "text-steady" : "text-muted"}`}>{row.aside}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
