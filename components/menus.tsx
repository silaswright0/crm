"use client";

import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { deleteCard, deleteStage, editCard, moveCard, renameStage } from "@/lib/actions";
import type { BoardCard, BoardStage, PipelineKind } from "@/lib/types";
import { buttonClass, fieldClass } from "@/components/ui";

const closeMenuContext = createContext<() => void>(() => {});

export function Kebab({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  function place() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 224;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const below = rect.bottom + 6;
    const top = below + 340 > window.innerHeight ? Math.max(8, rect.top - 340) : below;
    setBox({ top, left });
  }

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  return (
    <closeMenuContext.Provider value={() => setOpen(false)}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => {
          place();
          setOpen((value) => !value);
        }}
        className="mt-0.5 font-mono text-sm leading-none tracking-[0.15em] text-muted hover:text-ink"
      >
        ···
      </button>
      {open && box
        ? createPortal(
            <div
              ref={panelRef}
              id={menuId}
              role="menu"
              style={{ top: box.top, left: box.left }}
              onPointerDown={(event) => event.stopPropagation()}
              className="fixed z-30 w-56 border border-sign bg-paper p-3 shadow-[4px_4px_0_#102033]"
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </closeMenuContext.Provider>
  );
}

export function ColumnMenu({
  stage,
  stages,
  view,
  onMove,
}: {
  stage: BoardStage;
  stages: BoardStage[];
  view: "board" | "list";
  onMove: (stageId: string, direction: "left" | "right") => void;
}) {
  return (
    <Kebab label={`Actions for ${stage.name}`}>
      <ColumnMenuBody stage={stage} stages={stages} view={view} onMove={onMove} />
    </Kebab>
  );
}

function ColumnMenuBody({
  stage,
  stages,
  view,
  onMove,
}: {
  stage: BoardStage;
  stages: BoardStage[];
  view: "board" | "list";
  onMove: (stageId: string, direction: "left" | "right") => void;
}) {
  const close = useContext(closeMenuContext);
  const ordered = [...stages].sort((a, b) => a.position - b.position);
  const index = ordered.findIndex((item) => item.id === stage.id);

  function shift(direction: "left" | "right") {
    close();
    onMove(stage.id, direction);
  }

  return (
    <>
      <div>
        <p className="font-mono text-[11px] text-muted">Order</p>
        <div className="mt-1 flex gap-3">
          <button type="button" disabled={index <= 0} onClick={() => shift("left")} className="text-sm text-ink hover:text-lacquer disabled:text-muted">
            Move left
          </button>
          <button
            type="button"
            disabled={index < 0 || index >= ordered.length - 1}
            onClick={() => shift("right")}
            className="text-sm text-ink hover:text-lacquer disabled:text-muted"
          >
            Move right
          </button>
        </div>
      </div>
      <form action={renameStage} className="mt-3 space-y-2 border-t border-line pt-3">
        <input type="hidden" name="stageId" value={stage.id} />
        <input type="hidden" name="view" value={view} />
        <p className="font-mono text-[11px] text-muted">Rename</p>
        <input name="name" required maxLength={40} defaultValue={stage.name} className={fieldClass} />
        <button type="submit" className={buttonClass}>
          Save
        </button>
      </form>
      <form action={deleteStage} className="mt-3 border-t border-line pt-3">
        <input type="hidden" name="stageId" value={stage.id} />
        <input type="hidden" name="view" value={view} />
        <button type="submit" className="text-sm text-muted hover:text-ink">
          Delete
        </button>
      </form>
    </>
  );
}

export function CardMenu({
  card,
  stages,
  kind,
}: {
  card: BoardCard;
  stages: BoardStage[];
  kind: PipelineKind;
}) {
  return (
    <Kebab label={`Actions for ${card.title}`}>
      <CardMenuBody card={card} stages={stages} kind={kind} />
    </Kebab>
  );
}

function CardMenuBody({
  card,
  stages,
  kind,
}: {
  card: BoardCard;
  stages: BoardStage[];
  kind: PipelineKind;
}) {
  const router = useRouter();
  const close = useContext(closeMenuContext);
  const others = stages.filter((stage) => stage.id !== card.stageId);
  const dollars = card.valueCents == null ? "" : String(card.valueCents / 100);

  return (
    <>
      <div>
        <p className="font-mono text-[11px] text-muted">Move</p>
        {others.length === 0 ? <p className="mt-2 text-sm text-muted">This is the only column.</p> : null}
        <ul className="mt-1 max-h-40 overflow-y-auto">
          {others.map((stage) => (
            <li key={stage.id}>
              <button
                type="button"
                className="block w-full py-1 text-left text-sm hover:text-lacquer"
                onClick={async () => {
                  await moveCard(card.id, stage.id);
                  close();
                  router.refresh();
                }}
              >
                {stage.name}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <form action={editCard} onSubmit={() => close()} className="mt-3 space-y-2 border-t border-line pt-3">
        <p className="font-mono text-[11px] text-muted">Edit</p>
        <input type="hidden" name="id" value={card.id} />
        <input name="title" required maxLength={120} defaultValue={card.title} aria-label="Label" className={fieldClass} />
        {kind === "sales" ? (
          <input name="value" defaultValue={dollars} inputMode="decimal" aria-label="Value" placeholder="Value" className={fieldClass} />
        ) : null}
        <button type="submit" className={buttonClass}>
          Save
        </button>
      </form>
      <form action={deleteCard} onSubmit={() => close()} className="mt-3 border-t border-line pt-3">
        <input type="hidden" name="id" value={card.id} />
        <button type="submit" className="text-sm text-muted hover:text-ink">
          Delete
        </button>
      </form>
    </>
  );
}
