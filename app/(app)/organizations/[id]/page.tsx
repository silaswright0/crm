import Link from "next/link";
import { notFound } from "next/navigation";
import { updateOrganization } from "@/lib/actions";
import { getOrganization } from "@/lib/db/queries";
import { requireWorkspace } from "@/lib/session";
import { NextPanel, NoteComposer, RecordFrame, RelatedLinks, Timeline } from "@/components/record";
import { buttonClass, fieldClass, labelClass } from "@/components/ui";

export default async function OrganizationPage({ params }: { params: Promise<{ id: string }> }) {
  const { workspace } = await requireWorkspace();
  const { id } = await params;
  const record = await getOrganization(workspace.id, id);
  if (!record) notFound();

  const { organization } = record;
  const domain = organization.domain?.replace(/^https?:\/\//, "");

  return (
    <RecordFrame
      kicker="Organization"
      title={organization.name}
      quiet={record.quiet}
      identity={
        <form action={updateOrganization} className="space-y-3">
          <input type="hidden" name="id" value={organization.id} />
          <label className="block">
            <span className={labelClass}>Name</span>
            <input name="name" required defaultValue={organization.name} className={fieldClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Domain</span>
            <input name="domain" defaultValue={organization.domain ?? ""} className={fieldClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Industry</span>
            <input name="industry" defaultValue={organization.industry ?? ""} className={fieldClass} />
          </label>
          <button type="submit" className={buttonClass}>
            Save
          </button>
          {domain ? (
            <a href={`https://${domain}`} className="mt-4 block text-sm text-lacquer" rel="noreferrer">
              {domain}
            </a>
          ) : null}
          <div className="mt-5">
            <p className={labelClass}>People</p>
            {record.members.length === 0 ? <p className="text-sm text-muted">No one yet.</p> : null}
            <ul className="space-y-2">
              {record.members.map((member) => (
                <li key={member.id}>
                  <Link href={`/people/${member.id}`} className="text-sm hover:text-lacquer">
                    {member.name}
                    {member.title ? <span className="text-muted"> · {member.title}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <RelatedLinks
            label="Cards"
            items={record.cards.map((card) => ({ href: card.href, title: card.title, meta: card.stageName }))}
          />
        </form>
      }
      timeline={
        <>
          <Timeline items={record.timeline} />
          <NoteComposer hidden={{ organizationId: organization.id }} />
        </>
      }
      next={<NextPanel action={record.next} hidden={{ organizationId: organization.id }} />}
    />
  );
}
