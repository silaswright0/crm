"use client";

import { addStage } from "@/lib/actions";
import type { BoardStage, PipelineKind } from "@/lib/types";
import { ColumnMenu } from "@/components/menus";
import { buttonClass, fieldClass } from "@/components/ui";

export function ColumnNotice({ column }: { column?: string }) {
  if (column === "full") {
    return <p className="mb-4 text-sm text-lacquer">Move the cards off this column first.</p>;
  }
  if (column === "last") {
    return <p className="mb-4 text-sm text-lacquer">Keep one column.</p>;
  }
  return null;
}

export function AddColumn({ kind, view }: { kind: PipelineKind; view: "board" | "list" }) {
  return (
    <form action={addStage} className="w-72 shrink-0 space-y-2">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="view" value={view} />
      <p className="font-mono text-[11px] text-muted">New column</p>
      <input name="name" required maxLength={40} placeholder="Name" className={fieldClass} />
      <button type="submit" className={buttonClass}>
        Add column
      </button>
    </form>
  );
}

export function ColumnShelf({
  kind,
  stages,
}: {
  kind: PipelineKind;
  stages: BoardStage[];
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end gap-6">
      {stages.map((stage) => (
        <div key={stage.id} className="flex items-start gap-2 border-b-2 border-ink pb-2">
          <ColumnMenu stage={stage} view="list" />
          <p className="font-sign text-lg tracking-[-0.03em]">{stage.name}</p>
        </div>
      ))}
      <AddColumn kind={kind} view="list" />
    </div>
  );
}
