import { notFound } from "next/navigation";
import { updatePerson } from "@/lib/actions";
import { getPerson } from "@/lib/db/queries";
import { requireWorkspace } from "@/lib/session";
import { NextPanel, NoteComposer, RecordFrame, RelatedLinks, Timeline } from "@/components/record";
import { formatWhen } from "@/lib/format";
import { buttonClass, fieldClass, kickerClass, labelClass } from "@/components/ui";

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { workspace } = await requireWorkspace();
  const { id } = await params;
  const record = await getPerson(workspace.id, id);
  if (!record) notFound();

  const { person, organization } = record;

  return (
    <RecordFrame
      kicker="Person"
      title={person.name}
      quiet={record.quiet}
      identity={
        <form action={updatePerson} className="space-y-3">
          <p className={kickerClass}>
            Last touch · {record.lastTouch ? formatWhen(record.lastTouch) : "none yet"}
          </p>
          <input type="hidden" name="id" value={person.id} />
          <label className="block">
            <span className={labelClass}>Name</span>
            <input name="name" required defaultValue={person.name} className={fieldClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Title</span>
            <input name="title" defaultValue={person.title ?? ""} className={fieldClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Email</span>
            <input name="email" type="email" defaultValue={person.email ?? ""} className={fieldClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Phone</span>
            <input name="phone" defaultValue={person.phone ?? ""} className={fieldClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Organization</span>
            <select name="organizationId" defaultValue={person.organizationId ?? ""} className={fieldClass}>
              <option value="">None</option>
              {record.organizations.map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {choice.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={buttonClass}>
            Save
          </button>
          <RelatedLinks
            label="Organization"
            items={
              organization
                ? [{ href: `/organizations/${organization.id}`, title: organization.name, meta: organization.domain ?? undefined }]
                : []
            }
          />
          <RelatedLinks
            label="Cards"
            items={record.cards.map((card) => ({ href: card.href, title: card.title, meta: card.stageName }))}
          />
        </form>
      }
      timeline={
        <>
          <Timeline items={record.timeline} />
          <NoteComposer hidden={{ personId: person.id }} />
        </>
      }
      next={<NextPanel action={record.next} hidden={{ personId: person.id }} />}
    />
  );
}
