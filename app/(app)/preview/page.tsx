import { notFound } from "next/navigation";
import { renameWorkspace, setPlan } from "@/lib/actions";
import { isLocalRepo } from "@/lib/runtime";
import { requireWorkspace } from "@/lib/session";
import { PageHeader, buttonClass, fieldClass, ghostClass, labelClass } from "@/components/ui";

export default async function PreviewSettingsPage() {
  if (!isLocalRepo()) notFound();

  const { workspace, user } = await requireWorkspace();

  return (
    <div>
      <PageHeader title="Preview" lede="The name on the sign, and which paid pages are unlocked." />
      <div className="grid max-w-xl gap-10">
        <form action={renameWorkspace} className="space-y-3">
          <label className="block">
            <span className={labelClass}>Workspace</span>
            <input name="name" required defaultValue={workspace.name} className={fieldClass} />
          </label>
          <button type="submit" className={buttonClass}>
            Save the name
          </button>
        </form>
        <section>
          <h2 className="font-sign text-2xl tracking-[-0.03em]">Plan</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Local preview. Flipping the plan here takes no card. Free keeps Mail, Automations, and MCP locked. Pro lifts the lock.
          </p>
          <div className="mt-4 flex gap-2">
            <form action={setPlan}>
              <button type="submit" name="plan" value="free" disabled={workspace.plan === "free"} className={ghostClass}>
                Free
              </button>
            </form>
            <form action={setPlan}>
              <button type="submit" name="plan" value="pro" disabled={workspace.plan === "pro"} className={buttonClass}>
                Pro
              </button>
            </form>
          </div>
        </section>
        <section>
          <h2 className="font-sign text-2xl tracking-[-0.03em]">Members</h2>
          <p className="mt-3 text-sm">
            {user.name} <span className="text-muted">· Owner · {user.email}</span>
          </p>
          <p className="mt-2 text-sm text-muted">Invites come later.</p>
        </section>
      </div>
    </div>
  );
}
