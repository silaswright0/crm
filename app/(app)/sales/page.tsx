import { getBoard } from "@/lib/db/queries";
import { requireWorkspace } from "@/lib/session";
import { Board } from "@/components/board";
import { CardTable } from "@/components/card-table";
import { ColumnNotice, ColumnShelf } from "@/components/columns";
import { PageHeader, ViewToggle } from "@/components/ui";

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; column?: string }>;
}) {
  const { workspace } = await requireWorkspace();
  const params = await searchParams;
  const view = params.view === "list" ? "list" : "board";
  const board = await getBoard(workspace.id, "sales");

  return (
    <div>
      <PageHeader title="Sales" lede="Move a card when the conversation moves.">
        <ViewToggle base="/sales" view={view} />
      </PageHeader>
      <ColumnNotice column={params.column} />
      {view === "list" ? (
        <>
          <ColumnShelf kind="sales" stages={board.stages} />
          <CardTable kind="sales" stages={board.stages} cards={board.cards} />
        </>
      ) : (
        <Board kind="sales" stages={board.stages} cards={board.cards} />
      )}
    </div>
  );
}
