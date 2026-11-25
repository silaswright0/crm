import { mcpEndpoint, mcpTools } from "@/lib/desk";
import { requireWorkspace } from "@/lib/session";
import { DeskGate } from "@/components/desk";
import { PageHeader } from "@/components/ui";

export default async function McpPage() {
  const { workspace } = await requireWorkspace();
  const paid = workspace.plan === "pro";
  const endpoint = mcpEndpoint();
  const config = `{
  "mcpServers": {
    "musterlog": {
      "url": "${endpoint}"
    }
  }
}`;
  const groups = [...new Set(mcpTools.map((tool) => tool.group))];

  return (
    <div>
      <PageHeader
        title="MCP"
        lede="An assistant for this book. It can read and change the people, the organizations, the cards, and the notes. It cannot see another workspace, and it does not send mail."
      />
      <DeskGate locked={!paid}>
        <section className="border border-line bg-paper-2 p-5">
          <p className="font-mono text-[11px] text-muted">Door</p>
          <p className="mt-3 break-all font-mono text-sm leading-6">{endpoint}</p>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
            {paid
              ? "Pro owns this door. The server that answers it is the next build. A call will run as you, and only inside this book."
              : "The door is locked on Free. Pro is the plan that opens it."}
          </p>
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
