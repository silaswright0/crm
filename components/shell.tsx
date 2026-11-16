"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/actions";
import type { Plan } from "@/lib/types";
import { CommandPalette } from "@/components/command-palette";

const book = [
  { href: "/counter", label: "The Counter" },
  { href: "/people", label: "People" },
  { href: "/organizations", label: "Organizations" },
];

const boards = [
  { href: "/sales", label: "Sales" },
  { href: "/onboarding", label: "Onboarding" },
];

const desks = [
  { href: "/mail", label: "Mail" },
  { href: "/agents", label: "Agents" },
];

const settings = [{ href: "/settings", label: "Settings" }];

function NavLinks({
  items,
  pathname,
  locked,
}: {
  items: { href: string; label: string }[];
  pathname: string;
  locked?: boolean;
}) {
  return (
    <ul className="flex">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-2.5 py-2.5 text-sm ${
                active ? "border-lacquer text-ink" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              <span>{item.label}</span>
              {locked ? (
                <>
                  <span className="sr-only">, locked</span>
                  <span className="h-1.5 w-1.5 shrink-0 bg-lacquer" aria-hidden />
                </>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function Shell({
  workspaceName,
  plan,
  userName,
  children,
}: {
  workspaceName: string;
  plan: Plan;
  userName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const locked = plan !== "desk";
  const groups = [
    { items: book, locked: false },
    { items: boards, locked: false },
    { items: desks, locked },
    { items: settings, locked: false },
  ];

  return (
    <div className="flex h-dvh flex-col bg-paper">
      <header className="shrink-0 border-b border-sign">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <Link href="/counter" className="font-sign text-[1.7rem] leading-none tracking-[-0.045em]">
            Daybook
          </Link>
          <p className="max-w-40 truncate font-mono text-[11px] text-muted">{workspaceName}</p>
          <div className="order-3 w-full sm:order-none sm:ml-auto sm:w-72">
            <CommandPalette />
          </div>
          <div className="ml-auto flex items-center gap-3 sm:ml-0">
            <Link href="/settings" className="border border-ink px-2 py-0.5 font-mono text-[11px]">
              {plan === "desk" ? "Desk" : "Counter"}
            </Link>
            <p className="hidden max-w-32 truncate text-sm sm:block">{userName}</p>
            <form action={logout}>
              <button type="submit" className="text-sm text-muted hover:text-ink">
                Sign out
              </button>
            </form>
          </div>
        </div>
        <nav className="flex items-end overflow-x-auto px-2 sm:px-4">
          {groups.map((group, index) => (
            <div key={group.items[0]?.href} className="flex items-end">
              {index > 0 ? <span className="mx-1 mb-3 h-3 w-px shrink-0 bg-line" /> : null}
              <NavLinks items={group.items} pathname={pathname} locked={group.locked} />
            </div>
          ))}
        </nav>
      </header>
      <main className="min-h-0 flex-1 overflow-auto px-4 py-6 sm:px-8 sm:py-8">{children}</main>
    </div>
  );
}
