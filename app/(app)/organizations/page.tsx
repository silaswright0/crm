import Link from "next/link";
import { createOrganization } from "@/lib/actions";
import { listOrganizations } from "@/lib/db/queries";
import { requireWorkspace } from "@/lib/session";
import { EmptyLine, FilterChips, PageHeader, QuietMark, buttonClass, fieldClass, tableHeadClass } from "@/components/ui";

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { workspace } = await requireWorkspace();
  const params = await searchParams;
  const filter = params.filter === "quiet" ? "quiet" : "all";
  const organizations = (await listOrganizations(workspace.id)).filter((organization) => {
    if (filter === "quiet") return organization.quiet;
    return true;
  });

  return (
    <div>
      <PageHeader title="Organizations" lede="The shops, studios, and companies those people belong to.">
        <FilterChips base="/organizations" filter={filter} />
      </PageHeader>
      <form action={createOrganization} className="mb-6 flex flex-wrap items-end gap-2">
        <input name="name" required placeholder="Name" aria-label="Name" className={`${fieldClass} max-w-64`} />
        <input name="domain" placeholder="Domain" aria-label="Domain" className={`${fieldClass} max-w-56`} />
        <button type="submit" className={buttonClass}>
          Add
        </button>
      </form>
      {organizations.length === 0 ? (
        <EmptyLine>No organization matches. Add one, or clear the filter.</EmptyLine>
      ) : (
        <div className="overflow-x-auto border-y border-line">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className={tableHeadClass}>
              <tr>
                <th className="py-3 font-normal">Name</th>
                <th className="py-3 font-normal">Domain</th>
                <th className="py-3 font-normal">People</th>
                <th className="py-3 font-normal"> </th>
              </tr>
            </thead>
            <tbody>
              {organizations.map((organization) => (
                <tr key={organization.id} className={`border-t border-line ${organization.quiet ? "bg-quiet" : ""}`}>
                  <td className="py-3 pr-4">
                    <Link href={`/organizations/${organization.id}`} className="font-medium hover:text-lacquer">
                      {organization.name}
                    </Link>
                    {organization.industry ? (
                      <span className="mt-0.5 block text-xs text-muted">{organization.industry}</span>
                    ) : null}
                  </td>
                  <td className="py-3 pr-4">{organization.domain ?? "—"}</td>
                  <td className="py-3 pr-4">{organization.peopleCount}</td>
                  <td className="py-3 text-right">{organization.quiet ? <QuietMark /> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
