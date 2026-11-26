import Link from "next/link";
import { notFound } from "next/navigation";
import { moveCardFromForm, saveComment, toggleChecklist, updateCard } from "@/lib/actions";
import { money } from "@/lib/format";
import { getCard } from "@/lib/db/queries";
import { requireWorkspace } from "@/lib/session";
import { NextPanel, RecordFrame, Timeline } from "@/components/record";
import { buttonClass, fieldClass, ghostClass, labelClass } from "@/components/ui";

export default async function CardPage({ params }: { params: Promise<{ id: string }> }) {
  const { workspace } = await requireWorkspace();
  const { id } = await params;
  const record = await getCard(workspace.id, id);
  if (!record) notFound();

  const { card } = record;
  const dollars = card.valueCents == null ? "" : String(card.valueCents / 100);

  return (
    <RecordFrame
      kicker={record.pipelineKind === "sales" ? "Sales" : "Onboarding"}
      title={card.title}
      quiet={record.quiet}
      identity={
        <div className="space-y-5">
          <form action={updateCard} className="space-y-3">
            <input type="hidden" name="id" value={card.id} />
            <label className="block">
              <span className={labelClass}>Label</span>
              <input name="title" required defaultValue={card.title} className={fieldClass} />
            </label>
            {record.pipelineKind === "sales" ? (
              <label className="block">
                <span className={labelClass}>Value</span>
                <input name="value" defaultValue={dollars} inputMode="decimal" className={fieldClass} />
              </label>
            ) : null}
            <label className="block">
              <span className={labelClass}>Person</span>
              <select name="personId" defaultValue={card.personId ?? ""} className={fieldClass}>
                <option value="">None</option>
                {record.people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className={buttonClass}>
              Save
            </button>
          </form>
          {record.pipelineKind === "sales" ? (
            <p className="font-mono text-2xl text-lacquer">{money(card.valueCents)}</p>
          ) : null}
          <form action={moveCardFromForm} key={card.stageId} className="space-y-2">
            <input type="hidden" name="cardId" value={card.id} />
            <label className={labelClass} htmlFor="stage">
              Stage
            </label>
            <select id="stage" name="stageId" defaultValue={card.stageId} className={fieldClass}>
              {record.stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </select>
            <button type="submit" className={ghostClass}>
              Move
            </button>
          </form>
          {record.checks.length > 0 ? (
            <ul className="space-y-2">
              {record.checks.map((item) => (
                <li key={item.id}>
                  <form action={toggleChecklist}>
                    <input type="hidden" name="itemId" value={item.id} />
                    <button type="submit" className="flex items-center gap-2 text-left text-sm">
                      <span className={`inline-block h-3 w-3 border ${item.done ? "border-steady bg-steady" : "border-line"}`} />
                      <span className={item.done ? "text-muted line-through" : ""}>{item.label}</span>
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="space-y-2 text-sm">
            <Link href={`/organizations/${card.organizationId}`} className="block hover:text-lacquer">
              {record.organizationName}
            </Link>
            {card.personId && record.personName ? (
              <Link href={`/people/${card.personId}`} className="block text-muted hover:text-lacquer">
                {record.personName}
              </Link>
            ) : null}
          </div>
        </div>
      }
      timeline={
        <>
          <form id="comments" action={saveComment} key={card.comment ?? ""} className="mb-8 scroll-mt-8 space-y-2">
            <input type="hidden" name="id" value={card.id} />
            <label className={labelClass} htmlFor="comment">
              Comments
            </label>
            <textarea
              id="comment"
              name="comment"
              rows={14}
              defaultValue={card.comment ?? ""}
              placeholder="Notes on this card"
              className={`${fieldClass} min-h-72 leading-6`}
            />
            <button type="submit" className={buttonClass}>
              Save
            </button>
          </form>
          <Timeline items={record.timeline} />
        </>
      }
      next={<NextPanel action={record.next} hidden={{ cardId: card.id }} />}
    />
  );
}
