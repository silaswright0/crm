"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { createCard, moveCard, moveStage } from "@/lib/actions";
import { money } from "@/lib/format";
import type { BoardCard, BoardStage, PipelineKind } from "@/lib/types";
import { AddColumn, shiftStages } from "@/components/columns";
import { CardMenu, ColumnMenu } from "@/components/menus";
import { QuietMark, buttonClass, fieldClass } from "@/components/ui";

export function Board({
  kind,
  stages,
  cards,
}: {
  kind: PipelineKind;
  stages: BoardStage[];
  cards: BoardCard[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState<string | null>(null);
  const [order, setOrder] = useState(stages);
  const signature = stages.map((stage) => `${stage.id}:${stage.position}`).join();

  useEffect(() => {
    setOrder(stages);
  }, [signature, stages]);

  function onMove(stageId: string, direction: "left" | "right") {
    setOrder((current) => shiftStages(current, stageId, direction));
    void moveStage(stageId, direction).then(() => router.refresh());
  }
  const dragged = useRef(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  async function onDragEnd(event: DragEndEvent) {
    const stageId = event.over?.id ? String(event.over.id) : "";
    const cardId = String(event.active.id);
    const current = cards.find((card) => card.id === cardId);
    if (!stageId || !current || current.stageId === stageId) return;
    try {
      await moveCard(cardId, stageId);
    } catch {
      // The board redraws from the server either way.
    }
    router.refresh();
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={() => {
        dragged.current = true;
      }}
      onDragEnd={(event) => {
        onDragEnd(event);
        window.setTimeout(() => {
          dragged.current = false;
        }, 0);
      }}
      onDragCancel={() => {
        dragged.current = false;
      }}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {order.map((stage) => {
          const column = cards.filter((card) => card.stageId === stage.id);
          const total = column.reduce((sum, card) => sum + (card.valueCents ?? 0), 0);
          const doneCount = column.reduce((sum, card) => sum + card.checklistDone, 0);
          const stepCount = column.reduce((sum, card) => sum + card.checklistTotal, 0);
          return (
            <Column key={stage.id} stage={stage} stages={order} onMove={onMove}>
              <p className={`mt-2 font-mono text-xs ${stage.kind === "won" || stage.kind === "done" ? "text-steady" : "text-muted"}`}>
                {kind === "sales" ? money(column.length ? total : 0) : stepCount ? `${doneCount} of ${stepCount}` : "—"}
              </p>
              <div className="mt-3 space-y-2">
                {column.length === 0 ? <p className="text-sm text-muted">Nothing on this stage.</p> : null}
                {column.map((card) => (
                  <DealCard key={card.id} card={card} kind={kind} stages={order} dragged={dragged} />
                ))}
              </div>
              {adding === stage.id ? (
                <form action={createCard} onSubmit={() => setAdding(null)} className="mt-3 space-y-2 border-t border-line pt-3">
                  <input type="hidden" name="stageId" value={stage.id} />
                  <input name="organization" required placeholder="Organization" className={fieldClass} />
                  <input name="person" placeholder="Person" className={fieldClass} />
                  <input name="title" placeholder="Label" className={fieldClass} />
                  {kind === "sales" ? <input name="value" inputMode="decimal" placeholder="Value" className={fieldClass} /> : null}
                  <div className="flex gap-2">
                    <button type="submit" className={buttonClass}>
                      Add
                    </button>
                    <button type="button" onClick={() => setAdding(null)} className="px-2 text-sm text-muted">
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button type="button" onClick={() => setAdding(stage.id)} className="mt-3 text-sm text-lacquer">
                  Add
                </button>
              )}
            </Column>
          );
        })}
        <AddColumn kind={kind} view="board" />
      </div>
    </DndContext>
  );
}

function Column({
  stage,
  stages,
  onMove,
  children,
}: {
  stage: BoardStage;
  stages: BoardStage[];
  onMove: (stageId: string, direction: "left" | "right") => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  return (
    <section
      id={stage.id}
      ref={setNodeRef}
      className={`w-72 shrink-0 p-1 ${isOver ? "bg-quiet" : ""}`}
    >
      <header
        className={`flex items-start justify-between gap-3 border-b-2 pb-2 ${
          stage.kind === "won" || stage.kind === "done" ? "border-steady" : "border-ink"
        }`}
      >
        <h2 className="min-w-0 font-sign text-lg tracking-[-0.03em]">{stage.name}</h2>
        <ColumnMenu stage={stage} stages={stages} view="board" onMove={onMove} />
      </header>
      {children}
    </section>
  );
}

function DealCard({
  card,
  kind,
  stages,
  dragged,
}: {
  card: BoardCard;
  kind: PipelineKind;
  stages: BoardStage[];
  dragged: RefObject<boolean>;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id });
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;
  const who = card.personName ?? card.organizationName;
  const progress =
    kind === "onboarding" && card.checklistTotal > 0
      ? `${card.checklistDone} of ${card.checklistTotal}`
      : money(card.valueCents);

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`border border-line border-l-[3px] p-3 ${
        card.quiet ? "border-l-quiet-ink bg-quiet" : "border-l-sign bg-paper"
      } ${isDragging ? "opacity-60" : ""}`}
    >
      <div className="flex items-start gap-2">
        <CardMenu card={card} stages={stages} kind={kind} />
        <Link
          href={`/cards/${card.id}#comments`}
          onClick={(event) => {
            if (dragged.current) event.preventDefault();
          }}
          className="block min-w-0 flex-1"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-[15px] font-medium leading-snug hover:text-lacquer">{card.title}</span>
            {card.quiet ? <QuietMark /> : null}
          </div>
          <p className="mt-2 text-sm">{who}</p>
          <p className={`mt-3 font-mono text-sm ${kind === "sales" ? "text-lacquer" : "text-ink"}`}>{progress}</p>
          {card.nextText && !card.quiet ? <p className="mt-2 text-xs text-muted">{card.nextText}</p> : null}
        </Link>
      </div>
    </article>
  );
}
