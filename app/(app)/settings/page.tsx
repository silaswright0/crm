import { renameWorkspace, setPlan } from "@/lib/actions";
import { isLocalRepo } from "@/lib/runtime";
import { requireWorkspace } from "@/lib/session";
import { PageHeader, buttonClass, fieldClass, labelClass } from "@/components/ui";

const tiers = [
  {
    id: "free",
    name: "Free",
    prices: ["Free"],
    points: ["The book and both boards", "People and organizations", "Mail, Automations, and MCP stay locked"],
  },
  {
    id: "pro",
    name: "Pro",
    prices: ["$7.99 CAD / month", "$79.99 CAD / year"],
    points: ["Everything in Free", "Mail leaves this book", "Automations and the MCP door"],
  },
] as const;

export default async function SettingsPage() {
  const { workspace, user } = await requireWorkspace();
  const local = isLocalRepo();

  return (
    <div>
      <PageHeader title="Settings" lede="The name on the sign, the person who keeps this book, and the tier it sits on." />
      <div className="grid max-w-3xl gap-10">
        <form action={renameWorkspace} className="max-w-xl space-y-3">
          <label className="block">
            <span className={labelClass}>Workspace</span>
            <input name="name" required defaultValue={workspace.name} className={fieldClass} />
          </label>
          <button type="submit" className={buttonClass}>
            Save the name
          </button>
        </form>
        <section>
          <h2 className="font-sign text-2xl tracking-[-0.03em]">Subscription</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {tiers.map((tier) => {
              const current = workspace.plan === tier.id;
              const body = (
                <>
                  <p className="flex items-baseline justify-between gap-3">
                    <span className={`font-mono text-[11px] ${current ? "text-lacquer" : "text-muted"}`}>
                      {current ? "Current" : "Switch"}
                    </span>
                    <span className="flex flex-col items-end gap-1 text-right font-mono text-[11px] text-muted">
                      {tier.prices.map((price) => (
                        <span key={price}>{price}</span>
                      ))}
                    </span>
                  </p>
                  <h3 className="mt-3 font-sign text-3xl leading-none tracking-[-0.03em]">{tier.name}</h3>
                  <ul className="mt-4 space-y-1.5 text-sm leading-5">
                    {tier.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                  <p className={`mt-5 text-sm ${current ? "text-ink" : "text-muted"}`}>
                    {current ? "This book" : `Switch to ${tier.name}`}
                  </p>
                </>
              );

              if (current) {
                return (
                  <article
                    key={tier.id}
                    aria-current="true"
                    className="border-2 border-ink bg-paper px-4 py-4 text-ink shadow-[4px_4px_0_#102033]"
                  >
                    {body}
                  </article>
                );
              }

              const shaded = "h-full w-full border border-line bg-paper-2 px-4 py-4 text-left text-muted";
              if (!local) {
                return (
                  <article key={tier.id} className={shaded}>
                    {body}
                  </article>
                );
              }

              return (
                <form key={tier.id} action={setPlan} className="min-w-0">
                  <button
                    type="submit"
                    name="plan"
                    value={tier.id}
                    className={`${shaded} transition-colors hover:border-ink hover:bg-paper hover:text-ink`}
                  >
                    {body}
                  </button>
                </form>
              );
            })}
          </div>
        </section>
        <section>
          <h2 className="font-sign text-2xl tracking-[-0.03em]">Keeper</h2>
          <p className="mt-3 text-sm">
            {user.name} <span className="text-muted">· {user.email}</span>
          </p>
        </section>
      </div>
    </div>
  );
}
