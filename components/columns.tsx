"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { addStage, moveStage } from "@/lib/actions";
import type { BoardStage, PipelineKind } from "@/lib/types";
import { ColumnMenu } from "@/components/menus";
import { fieldClass } from "@/components/ui";

export function shiftStages(stages: BoardStage[], stageId: string, direction: "left" | "right") {
  const ordered = [...stages].sort((a, b) => a.position - b.position);
  const index = ordered.findIndex((stage) => stage.id === stageId);
  const neighbor = ordered[direction === "left" ? index - 1 : index + 1];
  const current = ordered[index];
  if (!current || !neighbor) return stages;
  return ordered
    .map((stage) => {
      if (stage.id === current.id) return { ...stage, position: neighbor.position };
      if (stage.id === neighbor.id) return { ...stage, position: current.position };
      return stage;
    })
    .sort((a, b) => a.position - b.position);
}

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
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Create a new column"
        className="group relative flex h-8 w-8 shrink-0 items-center justify-center self-start text-muted hover:text-ink"
      >
        <span className="pointer-events-none absolute right-full mr-2 hidden whitespace-nowrap text-sm group-hover:block group-focus-visible:block">
          Create a new column
        </span>
        <span className="text-xl leading-none">+</span>
      </button>
    );
  }

  return (
    <form action={addStage} className="flex w-56 shrink-0 items-center gap-2 self-start">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="view" value={view} />
      <input name="name" required maxLength={40} placeholder="Name" aria-label="Column name" autoFocus className={fieldClass} />
      <button type="submit" className="text-sm text-ink hover:text-lacquer">
        Add
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted">
        Cancel
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
  const router = useRouter();
  const [order, setOrder] = useState(stages);
  const signature = stages.map((stage) => `${stage.id}:${stage.position}`).join();

  useEffect(() => {
    setOrder(stages);
  }, [signature, stages]);

  function onMove(stageId: string, direction: "left" | "right") {
    setOrder((current) => shiftStages(current, stageId, direction));
    void moveStage(stageId, direction).then(() => router.refresh());
  }

  return (
    <div className="mb-8 flex flex-wrap items-end gap-6">
      {order.map((stage) => (
        <div key={stage.id} className="flex items-start gap-2 border-b-2 border-ink pb-2">
          <p className="font-sign text-lg tracking-[-0.03em]">{stage.name}</p>
          <ColumnMenu stage={stage} stages={order} view="list" onMove={onMove} />
        </div>
      ))}
      <AddColumn kind={kind} view="list" />
    </div>
  );
}
