import { Shell } from "@/components/shell";
import { requireWorkspace } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { workspace, user } = await requireWorkspace();

  return (
    <Shell workspaceName={workspace.name} plan={workspace.plan} userName={user.name}>
      {children}
    </Shell>
  );
}
