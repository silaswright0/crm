import { renameWorkspace, setPlan } from "@/lib/actions";
import { requireWorkspace } from "@/lib/session";
import { PageHeader, buttonClass, fieldClass, ghostClass, labelClass } from "@/components/ui";

export default async function SettingsPage() {
  const { workspace, user } = await requireWorkspace();

  return (
    <div>
      <PageHeader title="Settings" lede="The name on the sign, and which desks are unlocked." />
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
            Local preview. This does not bill anyone. Counter keeps Mail and Agents locked. Desk lifts the lock so you can look at them.
          </p>
          <div className="mt-4 flex gap-2">
            <form action={setPlan}>
              <button type="submit" name="plan" value="counter" disabled={workspace.plan === "counter"} className={ghostClass}>
                Counter
              </button>
            </form>
            <form action={setPlan}>
              <button type="submit" name="plan" value="desk" disabled={workspace.plan === "desk"} className={buttonClass}>
                Desk
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
