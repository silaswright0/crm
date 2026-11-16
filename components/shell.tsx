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
    <ul className="flex gap-1 md:block">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center justify-between gap-3 whitespace-nowrap px-2 py-2 text-[13px] uppercase tracking-[0.14em] ${
                active ? "text-paper" : "text-sign-muted hover:text-paper"
              }`}
            >
              <span>{item.label}</span>
              {locked ? <span className="text-[10px] tracking-[0.16em] text-lacquer">Desk</span> : null}
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

  return (
    <div className="flex h-dvh flex-col bg-paper md:flex-row">
      <aside className="flex shrink-0 flex-col bg-sign text-paper md:h-full md:w-56">
        <div className="flex items-end justify-between gap-4 px-4 py-4 md:block md:px-5 md:pt-7">
          <div>
            <Link href="/counter" className="font-sign text-3xl leading-none tracking-tight">
              Daybook
            </Link>
            <p className="mt-2 max-w-40 truncate text-[11px] uppercase tracking-[0.18em] text-sign-muted">
              {workspaceName}
            </p>
          </div>
          <form action={logout} className="md:hidden">
            <button type="submit" className="text-[11px] uppercase tracking-[0.14em] text-sign-muted">
              Sign out
            </button>
          </form>
        </div>
        <nav className="flex gap-4 overflow-x-auto px-2 pb-3 md:block md:flex-1 md:overflow-visible md:px-3">
          <p className="hidden px-2 pt-6 text-[10px] uppercase tracking-[0.18em] text-sign-muted md:block">Book</p>
          <NavLinks items={book} pathname={pathname} />
          <p className="hidden px-2 pt-5 text-[10px] uppercase tracking-[0.18em] text-sign-muted md:block">Boards</p>
          <NavLinks items={boards} pathname={pathname} />
          <p className="hidden px-2 pt-5 text-[10px] uppercase tracking-[0.18em] text-sign-muted md:block">Desks</p>
          <NavLinks items={desks} pathname={pathname} locked={locked} />
          <NavLinks items={[{ href: "/settings", label: "Settings" }]} pathname={pathname} />
        </nav>
        <div className="mt-auto hidden px-4 pb-5 md:block">
          <Link href="/settings" className="block border border-white/15 px-3 py-3 hover:border-white/40">
            <p className="text-[10px] uppercase tracking-[0.16em] text-sign-muted">Plan</p>
            <p className="font-sign text-2xl leading-none">{plan === "desk" ? "Desk" : "Counter"}</p>
          </Link>
          <p className="mt-4 truncate text-sm">{userName}</p>
          <form action={logout} className="mt-1">
            <button type="submit" className="text-[11px] uppercase tracking-[0.14em] text-sign-muted hover:text-paper">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-line px-4 py-3 sm:px-6">
          <CommandPalette />
          <Link href="/settings" className="text-[11px] uppercase tracking-[0.14em] text-muted md:hidden">
            {plan === "desk" ? "Desk" : "Counter"}
          </Link>
        </header>
        <main className="min-h-0 flex-1 overflow-auto px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
