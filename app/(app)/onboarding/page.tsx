import { getBoard } from "@/lib/db/queries";
import { requireWorkspace } from "@/lib/session";
import { Board } from "@/components/board";
import { CardTable } from "@/components/card-table";
import { PageHeader, ViewToggle } from "@/components/ui";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { workspace } = await requireWorkspace();
  const params = await searchParams;
  const view = params.view === "list" ? "list" : "board";
  const board = await getBoard(workspace.id, "onboarding");

  return (
    <div>
      <PageHeader title="Onboarding" lede="After the yes, the work of getting them steady.">
        <ViewToggle base="/onboarding" view={view} />
      </PageHeader>
      {view === "list" ? (
        <CardTable kind="onboarding" stages={board.stages} cards={board.cards} />
      ) : (
        <Board kind="onboarding" stages={board.stages} cards={board.cards} />
      )}
    </div>
  );
}
