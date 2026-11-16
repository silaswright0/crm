import Link from "next/link";
import { moveCardFromForm } from "@/lib/actions";
import { money } from "@/lib/format";
import type { BoardCard, BoardStage, PipelineKind } from "@/lib/types";
import { QuietMark, buttonClass, fieldClass, tableHeadClass } from "@/components/ui";

export function CardTable({
  kind,
  stages,
  cards,
}: {
  kind: PipelineKind;
  stages: BoardStage[];
  cards: BoardCard[];
}) {
  if (cards.length === 0) {
    return <p className="font-sign text-2xl tracking-[-0.03em]">Nothing on this board yet.</p>;
  }

  return (
    <div className="overflow-x-auto border-y border-line">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className={tableHeadClass}>
          <tr>
            <th className="py-3 font-normal">Card</th>
            <th className="py-3 font-normal">Who</th>
            <th className="py-3 font-normal">{kind === "sales" ? "Value" : "Progress"}</th>
            <th className="py-3 font-normal">Stage</th>
          </tr>
        </thead>
        <tbody>
          {cards.map((card) => (
            <tr key={card.id} className={`border-t border-line ${card.quiet ? "bg-quiet" : ""}`}>
              <td className="py-3 pr-4">
                <Link href={`/cards/${card.id}`} className="font-medium hover:text-lacquer">
                  {card.title}
                </Link>
                {card.quiet ? <span className="ml-2"><QuietMark /></span> : null}
              </td>
              <td className="py-3 pr-4">{card.personName ?? card.organizationName}</td>
              <td className={`py-3 pr-4 ${kind === "sales" ? "text-lacquer" : ""}`}>
                {kind === "onboarding" && card.checklistTotal > 0
                  ? `${card.checklistDone} of ${card.checklistTotal}`
                  : money(card.valueCents)}
              </td>
              <td className="py-3">
                <form action={moveCardFromForm} className="flex gap-2">
                  <input type="hidden" name="cardId" value={card.id} />
                  <select name="stageId" defaultValue={card.stageId} className={fieldClass}>
                    {stages.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.name}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className={buttonClass}>
                    Move
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
