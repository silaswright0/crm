import Link from "next/link";
import { sequences } from "@/lib/placeholders";
import { requireWorkspace } from "@/lib/session";
import { DeskGate } from "@/components/desk";
import { PageHeader } from "@/components/ui";

export default async function MailPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { workspace } = await requireWorkspace();
  const params = await searchParams;

  return (
    <div>
      <PageHeader
        title="Mail"
        lede="Sequences for the book. They will send from this workspace’s own address later. Nothing sends now."
      />
      <DeskGate locked={workspace.plan !== "desk"} notice={params.notice}>
        <ul className="divide-y divide-line border-y border-line">
          {sequences.map((sequence) => (
            <li key={sequence.slug}>
              <Link href={`/mail/${sequence.slug}`} className="grid gap-2 py-4 hover:text-lacquer sm:grid-cols-[1fr_auto_auto] sm:items-baseline">
                <span>
                  <span className="block font-sign text-2xl leading-none tracking-[-0.03em]">{sequence.name}</span>
                  <span className="mt-2 block text-sm text-muted">{sequence.audience}</span>
                </span>
                <span className="text-sm text-muted">{sequence.steps.length} steps</span>
                <span className="font-mono text-[11px] text-muted">{sequence.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      </DeskGate>
    </div>
  );
}
