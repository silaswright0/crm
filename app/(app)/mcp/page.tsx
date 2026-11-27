import { mintMcpToken } from "@/lib/actions";
import { getMcpToken } from "@/lib/db/queries";
import { mcpEndpoint, mcpTools } from "@/lib/desk";
import { formatWhen } from "@/lib/format";
import { requireWorkspace } from "@/lib/session";
import { DeskGate } from "@/components/desk";
import { PageHeader, buttonClass } from "@/components/ui";

export default async function McpPage({
  searchParams,
}: {
  searchParams: Promise<{ issued?: string }>;
}) {
  const { workspace } = await requireWorkspace();
  const paid = workspace.plan === "pro";
  const params = await searchParams;
  const issued = params.issued && /^ml_[0-9a-f]{64}$/i.test(params.issued) ? params.issued : null;
  const saved = paid ? await getMcpToken(workspace.id) : null;
  const endpoint = mcpEndpoint();
  const bearer = issued ? `Bearer ${issued}` : "Bearer <the token you minted>";
  const config = `{
  "mcpServers": {
    "musterlog": {
      "url": "${endpoint}",
      "headers": {
        "Authorization": "${bearer}"
      }
    }
  }
}`;
  const groups = [...new Set(mcpTools.map((tool) => tool.group))];

  return (
    <div>
      <PageHeader
        title="MCP"
        lede="An assistant for this book. It can read and change the people, the organizations, the cards, the notes, the mail, and the automations. It cannot see another workspace."
      />
      <DeskGate locked={!paid}>
        <section className="border border-line bg-paper-2 p-5">
          <p className="font-mono text-[11px] text-muted">Door</p>
          <p className="mt-3 break-all font-mono text-sm leading-6">{endpoint}</p>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
            {paid
              ? "Pro owns this door. A call runs as you, and only inside this book. send_mail sends immediately."
              : "The door is locked on Free. Pro is the plan that opens it."}
          </p>
          {paid && issued ? (
            <div className="mt-4 border-l-4 border-steady pl-4">
              <p className="text-sm leading-6">Copy this token. It is shown once. Minting again replaces it.</p>
              <p className="mt-2 break-all font-mono text-sm leading-6">{issued}</p>
            </div>
          ) : null}
          {paid && !issued ? (
            <p className="mt-4 text-sm leading-6 text-muted">
              {saved ? `A token is saved, minted ${formatWhen(saved.createdAt)}.` : "No token yet."} Minting again replaces it.
            </p>
          ) : null}
          {paid ? (
            <form action={mintMcpToken} className="mt-4">
              <button type="submit" className={buttonClass}>
                {saved || issued ? "Mint a new token" : "Mint a token"}
              </button>
            </form>
          ) : null}
        </section>
        {groups.map((group) => (
          <section key={group} className="mt-8">
            <h2 className="font-sign text-2xl tracking-[-0.03em]">{group}</h2>
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {mcpTools
                .filter((tool) => tool.group === group)
                .map((tool) => (
                  <li key={tool.name} className="grid gap-1 py-3 sm:grid-cols-[16rem_1fr] sm:items-baseline">
                    <span className="font-mono text-sm">{tool.name}</span>
                    <span className="text-sm text-muted">{tool.detail}</span>
                  </li>
                ))}
            </ul>
          </section>
        ))}
        <section className="mt-8">
          <h2 className="font-sign text-2xl tracking-[-0.03em]">Client</h2>
          <pre className="mt-3 overflow-x-auto bg-sign p-4 font-mono text-sm leading-6 text-paper">{config}</pre>
        </section>
      </DeskGate>
    </div>
  );
}
