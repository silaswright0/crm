import { renameWorkspace } from "@/lib/actions";
import { requireWorkspace } from "@/lib/session";
import { PageHeader, buttonClass, fieldClass, labelClass } from "@/components/ui";

export default async function SettingsPage() {
  const { workspace, user } = await requireWorkspace();

  return (
    <div>
      <PageHeader title="Settings" lede="The name on the sign, and the person who keeps this book." />
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
          <h2 className="font-sign text-2xl tracking-[-0.03em]">Keeper</h2>
          <p className="mt-3 text-sm">
            {user.name} <span className="text-muted">· {user.email}</span>
          </p>
        </section>
      </div>
    </div>
  );
}
