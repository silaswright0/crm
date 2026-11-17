import { holdPlaceholder } from "@/lib/actions";
import { agentScopes, sampleAudit } from "@/lib/placeholders";
import { requireWorkspace } from "@/lib/session";
import { DeskGate } from "@/components/desk";
import { PageHeader, buttonClass, ghostClass } from "@/components/ui";

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { workspace } = await requireWorkspace();
  const params = await searchParams;
  const locked = workspace.plan !== "desk";
  const endpoint = `${(process.env.APP_URL ?? "https://your-host").replace(/\/$/, "")}/mcp`;
  const config = `{
  "mcpServers": {
    "musterlog": {
      "url": "${endpoint}"
    }
  }
}`;

  return (
    <div>
      <PageHeader
        title="Agents"
        lede="A door an assistant could use to read this book and move a card. The door is not open."
      />
      <DeskGate locked={locked} notice={params.notice}>
        <section className="border border-line bg-paper-2 p-5">
          <p className="font-mono text-[11px] text-muted">Connection</p>
          <p className="mt-3 break-all font-mono text-sm leading-6">{endpoint}</p>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
            This address is a shape, not a server. An assistant will one day act as the member who connected it, and only inside this workspace.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {locked ? (
              <>
                <button type="button" disabled className={buttonClass}>
                  Connect
                </button>
                <button type="button" disabled className={ghostClass}>
                  Rotate key
                </button>
              </>
            ) : (
              <>
                <form action={holdPlaceholder}>
                  <input type="hidden" name="to" value="/agents" />
                  <button type="submit" className={buttonClass}>
                    Connect
                  </button>
                </form>
                <form action={holdPlaceholder}>
                  <input type="hidden" name="to" value="/agents" />
                  <button type="submit" className={ghostClass}>
                    Rotate key
                  </button>
                </form>
              </>
            )}
          </div>
        </section>
        <section className="mt-8">
          <h2 className="font-sign text-2xl tracking-[-0.03em]">Scopes</h2>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {agentScopes.map((scope) => (
              <li key={scope.id} className="grid gap-1 py-3 sm:grid-cols-[14rem_1fr]">
                <span>{scope.label}</span>
                <span className="text-sm text-muted">{scope.detail}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="mt-8">
          <h2 className="font-sign text-2xl tracking-[-0.03em]">Client config</h2>
          <pre className="mt-3 overflow-x-auto bg-sign p-4 font-mono text-sm leading-6 text-paper">{config}</pre>
        </section>
        <section className="mt-8">
          <h2 className="font-sign text-2xl tracking-[-0.03em]">Audit</h2>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {sampleAudit.map((row) => (
              <li key={row.tool} className="grid gap-1 py-3 text-sm sm:grid-cols-[5rem_1fr_8rem_1fr] sm:items-baseline">
                <span className="font-mono text-[11px] text-quiet-ink">{row.when}</span>
                <span>{row.who}</span>
                <span>{row.tool}</span>
                <span className="text-muted">{row.result}</span>
              </li>
            ))}
          </ul>
        </section>
      </DeskGate>
    </div>
  );
}
