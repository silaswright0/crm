"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createOrganization, createPerson } from "@/lib/actions";
import { fieldClass } from "@/components/ui";

type SearchHit = { id: string; label: string; meta: string; href: string };

const jumps = [
  { href: "/counter", label: "The Counter" },
  { href: "/people", label: "People" },
  { href: "/organizations", label: "Organizations" },
  { href: "/sales", label: "Sales" },
  { href: "/onboarding", label: "Onboarding" },
  { href: "/mail", label: "Mail" },
  { href: "/agents", label: "Agents" },
  { href: "/settings", label: "Settings" },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const term = query.trim();
    if (!term) return;
    const handle = window.setTimeout(async () => {
      const response = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
      if (!response.ok) return;
      const data = (await response.json()) as {
        people: { id: string; name: string; email: string | null }[];
        organizations: { id: string; name: string; domain: string | null }[];
        cards: { id: string; title: string; organizationName: string }[];
      };
      setHits([
        ...data.people.map((person) => ({
          id: person.id,
          label: person.name,
          meta: person.email || "Person",
          href: `/people/${person.id}`,
        })),
        ...data.organizations.map((organization) => ({
          id: organization.id,
          label: organization.name,
          meta: organization.domain || "Organization",
          href: `/organizations/${organization.id}`,
        })),
        ...data.cards.map((card) => ({
          id: card.id,
          label: card.title,
          meta: card.organizationName,
          href: `/cards/${card.id}`,
        })),
      ]);
    }, 120);
    return () => window.clearTimeout(handle);
  }, [open, query]);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  const shownJumps = jumps.filter((jump) => jump.label.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between border border-line bg-paper px-3 py-2 text-left text-sm text-muted"
      >
        <span>Search the book</span>
        <span className="font-mono text-[11px]">Ctrl K</span>
      </button>
      {open ? (
        <div className="fixed inset-0 z-40 bg-sign/50" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Search the book"
            className="mx-auto mt-[10vh] w-[min(40rem,calc(100%-2rem))] border-2 border-sign bg-paper p-5 shadow-[8px_8px_0_#102033]"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="font-sign text-4xl leading-none tracking-[-0.04em]">Search</p>
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                if (!event.target.value.trim()) setHits([]);
              }}
              placeholder="A person, a shop, a card"
              className={`${fieldClass} mt-3`}
            />
            <div className="mt-4 max-h-72 overflow-auto">
              {shownJumps.length > 0 ? (
                <ul>
                  {shownJumps.map((jump) => (
                    <li key={jump.href}>
                      <button type="button" onClick={() => go(jump.href)} className="block w-full px-1 py-2 text-left text-sm hover:text-lacquer">
                        {jump.label}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {hits.length > 0 ? (
                <ul className="mt-2 border-t border-line">
                  {hits.map((hit) => (
                    <li key={hit.href}>
                      <button type="button" onClick={() => go(hit.href)} className="flex w-full items-baseline justify-between gap-3 px-1 py-2 text-left hover:text-lacquer">
                        <span>{hit.label}</span>
                        <span className="text-xs text-muted">{hit.meta}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
              <form action={createPerson} className="space-y-2">
                <input type="hidden" name="return" value="record" />
                <p className={labelLike}>New person</p>
                <input name="name" required placeholder="Name" className={fieldClass} />
                <input name="email" type="email" placeholder="Email" className={fieldClass} />
                <button type="submit" className="text-sm text-lacquer">
                  Add person
                </button>
              </form>
              <form action={createOrganization} className="space-y-2">
                <input type="hidden" name="return" value="record" />
                <p className={labelLike}>New organization</p>
                <input name="name" required placeholder="Name" className={fieldClass} />
                <input name="domain" placeholder="Domain" className={fieldClass} />
                <button type="submit" className="text-sm text-lacquer">
                  Add organization
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

const labelLike = "font-mono text-[11px] text-muted";
