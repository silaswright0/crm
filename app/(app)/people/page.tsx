import Link from "next/link";
import { createPerson } from "@/lib/actions";
import { listPeople } from "@/lib/db/queries";
import { requireWorkspace } from "@/lib/session";
import { EmptyLine, FilterChips, PageHeader, QuietMark, buttonClass, fieldClass, tableHeadClass } from "@/components/ui";

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { workspace } = await requireWorkspace();
  const params = await searchParams;
  const filter = params.filter === "quiet" || params.filter === "open" ? params.filter : "all";
  const people = (await listPeople(workspace.id)).filter((person) => {
    if (filter === "quiet") return person.quiet;
    if (filter === "open") return person.hasOpenCard;
    return true;
  });

  return (
    <div>
      <PageHeader title="People" lede="Everyone on the book, whether or not they have a card.">
        <FilterChips base="/people" filter={filter} />
      </PageHeader>
      <form action={createPerson} className="mb-6 flex flex-wrap items-end gap-2">
        <input name="name" required placeholder="Name" aria-label="Name" className={`${fieldClass} max-w-56`} />
        <input name="email" type="email" placeholder="Email" aria-label="Email" className={`${fieldClass} max-w-64`} />
        <button type="submit" className={buttonClass}>
          Add
        </button>
      </form>
      {people.length === 0 ? (
        <EmptyLine>Nobody matches. Add the first name, or clear the filter.</EmptyLine>
      ) : (
        <div className="overflow-x-auto border-y border-line">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className={tableHeadClass}>
              <tr>
                <th className="py-3 font-normal">Name</th>
                <th className="py-3 font-normal">Organization</th>
                <th className="py-3 font-normal">Email</th>
                <th className="py-3 font-normal"> </th>
              </tr>
            </thead>
            <tbody>
              {people.map((person) => (
                <tr key={person.id} className={`border-t border-line ${person.quiet ? "bg-quiet" : ""}`}>
                  <td className="py-3 pr-4">
                    <Link href={`/people/${person.id}`} className="font-medium hover:text-lacquer">
                      {person.name}
                    </Link>
                    {person.title ? <span className="mt-0.5 block text-xs text-muted">{person.title}</span> : null}
                  </td>
                  <td className="py-3 pr-4">{person.organizationName ?? "—"}</td>
                  <td className="py-3 pr-4">{person.email ?? "—"}</td>
                  <td className="py-3 text-right">{person.quiet ? <QuietMark /> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
