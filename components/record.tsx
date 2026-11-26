import { addNote, completeNextAction, saveNextAction } from "@/lib/actions";
import type { NextActionView, TimelineItem } from "@/lib/types";
import { activityKicker } from "@/lib/db/queries";
import { QuietMark, buttonClass, fieldClass, ghostClass, kickerClass, labelClass } from "@/components/ui";
import Link from "next/link";

export function RecordFrame({
  kicker,
  title,
  quiet,
  identity,
  timeline,
  next,
}: {
  kicker: string;
  title: string;
  quiet: boolean;
  identity: React.ReactNode;
  timeline: React.ReactNode;
  next: React.ReactNode;
}) {
  return (
    <div>
      <p className={kickerClass}>{kicker}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-sign text-4xl leading-[0.9] tracking-[-0.04em] sm:text-5xl">{title}</h1>
        {quiet ? <QuietMark /> : null}
      </div>
      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[16rem_minmax(0,1fr)_16rem]">
        <section>{identity}</section>
        <section className="min-w-0">{timeline}</section>
        <section>{next}</section>
      </div>
    </div>
  );
}

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <div>
      <ol className="space-y-5 border-l border-line pl-4">
        {items.length === 0 ? <li className="text-sm text-muted">Nothing has been written yet.</li> : null}
        {items.map((item) => (
          <li key={item.id}>
            <p className={kickerClass}>
              {activityKicker(item.kind)} · {item.when}
            </p>
            <p className="mt-1 text-sm leading-6">{item.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function NoteComposer({ hidden }: { hidden: Record<string, string> }) {
  return (
    <form action={addNote} className="mt-6 space-y-2">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <label className={labelClass} htmlFor={`note-${Object.values(hidden)[0] ?? "new"}`}>
        Leave a note
      </label>
      <textarea id={`note-${Object.values(hidden)[0] ?? "new"}`} name="body" required rows={3} className={fieldClass} />
      <button type="submit" className={buttonClass}>
        Post
      </button>
    </form>
  );
}

export function NextPanel({
  action,
  hidden,
}: {
  action: NextActionView | null;
  hidden: Record<string, string>;
}) {
  return (
    <div className="border-l-4 border-sign pl-4">
      <p className={kickerClass}>Next steps</p>
      {action ? (
        <div className="mt-3">
          <p className="font-sign text-2xl leading-tight tracking-[-0.03em]">{action.text}</p>
          <p className={`mt-2 text-sm ${action.overdue ? "text-lacquer" : "text-muted"}`}>
            {action.overdue ? "Overdue" : "Due"} {action.dueOn}
          </p>
          <form action={completeNextAction} className="mt-3">
            <input type="hidden" name="actionId" value={action.id} />
            <button type="submit" className={ghostClass}>
              Mark done
            </button>
          </form>
        </div>
      ) : (
        <p className="mt-3 font-sign text-2xl tracking-[-0.03em]">Nothing scheduled.</p>
      )}
      <form action={saveNextAction} className="mt-4 space-y-2 border-t border-line pt-4">
        {Object.entries(hidden).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        {action ? <input type="hidden" name="actionId" value={action.id} /> : null}
        <label className={labelClass} htmlFor={`next-${action?.id ?? "new"}`}>
          {action ? "Change it" : "Schedule one"}
        </label>
        <input id={`next-${action?.id ?? "new"}`} name="text" required defaultValue={action?.text ?? ""} className={fieldClass} />
        <input name="dueOn" type="date" required defaultValue={action?.dueOn ?? ""} className={fieldClass} />
        <button type="submit" className={buttonClass}>
          Save
        </button>
      </form>
    </div>
  );
}

export function RelatedLinks({
  label,
  items,
}: {
  label: string;
  items: { href: string; title: string; meta?: string }[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-5">
      <p className={labelClass}>{label}</p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="block hover:text-lacquer">
              <span className="block text-sm">{item.title}</span>
              {item.meta ? <span className="block text-xs text-muted">{item.meta}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
