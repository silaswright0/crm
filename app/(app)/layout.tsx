import { Shell } from "@/components/shell";
import { isLocalRepo } from "@/lib/runtime";
import { requireWorkspace } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { workspace, user } = await requireWorkspace();

  return (
    <Shell workspaceName={workspace.name} plan={workspace.plan} userName={user.name} showPreview={isLocalRepo()}>
      {children}
    </Shell>
  );
}
