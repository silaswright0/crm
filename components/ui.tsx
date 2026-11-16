import Link from "next/link";

export const fieldClass =
  "w-full border border-line bg-paper px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus:border-lacquer";

export const labelClass = "mb-1 block text-[11px] uppercase tracking-[0.14em] text-muted";

export const buttonClass =
  "bg-lacquer px-3 py-2 text-sm text-paper transition-colors hover:bg-[#7c2d12] disabled:opacity-40";

export const ghostClass =
  "border border-line bg-transparent px-3 py-2 text-sm text-ink transition-colors hover:border-ink disabled:opacity-40";

export function QuietMark() {
  return (
    <span className="inline-flex shrink-0 items-center bg-quiet px-2 py-0.5 text-[11px] uppercase tracking-[0.14em] text-quiet-ink">
      Quiet
    </span>
  );
}

export function PageHeader({
  title,
  lede,
  children,
}: {
  title: string;
  lede?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-sign text-4xl tracking-tight text-ink sm:text-5xl">{title}</h1>
        {lede ? <p className="mt-2 max-w-xl text-sm leading-6 text-muted">{lede}</p> : null}
      </div>
      {children}
    </div>
  );
}

export function FilterChips({
  base,
  filter,
}: {
  base: string;
  filter: "all" | "quiet" | "open";
}) {
  const options = [
    ["all", "All"],
    ["quiet", "Quiet"],
    ["open", "Has an open card"],
  ] as const;

  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([id, label]) => {
        const active = filter === id;
        return (
          <Link
            key={id}
            href={id === "all" ? base : `${base}?filter=${id}`}
            className={`px-3 py-1.5 text-sm ${active ? "bg-ink text-paper" : "border border-line text-ink hover:border-ink"}`}
            aria-current={active ? "page" : undefined}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}

export function ViewToggle({
  base,
  view,
}: {
  base: string;
  view: "board" | "list";
}) {
  return (
    <div className="flex border border-line">
      {(
        [
          ["board", "Board"],
          ["list", "List"],
        ] as const
      ).map(([id, label]) => (
        <Link
          key={id}
          href={id === "board" ? base : `${base}?view=list`}
          className={`px-3 py-1.5 text-sm ${view === id ? "bg-ink text-paper" : "text-ink"}`}
          aria-current={view === id ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

export function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="font-sign text-2xl text-ink">{children}</p>;
}
