import Link from "next/link";

export const fieldClass =
  "w-full border border-line bg-paper px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus:border-ink";

export const labelClass = "mb-1.5 block font-mono text-[11px] text-muted";

export const kickerClass = "font-mono text-[11px] text-muted";

export const tableHeadClass = "font-mono text-[11px] font-normal text-muted";

export const buttonClass =
  "bg-lacquer px-3 py-2 text-sm font-medium text-paper transition-colors hover:bg-lacquer-deep disabled:opacity-40";

export const ghostClass =
  "border border-ink bg-transparent px-3 py-2 text-sm text-ink transition-colors hover:bg-ink hover:text-paper disabled:opacity-40";

export function QuietMark() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-[11px] text-quiet-ink">
      <span className="h-1.5 w-1.5 bg-quiet-ink" aria-hidden />
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
    <div className="mb-8 border-b border-ink pb-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-sign text-[2.6rem] leading-[0.9] tracking-[-0.04em] text-ink">{title}</h1>
          {lede ? <p className="mt-3 max-w-xl text-sm leading-6 text-muted">{lede}</p> : null}
        </div>
        {children}
      </div>
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
            className={`px-3 py-1.5 text-sm ${active ? "bg-ink text-paper" : "border border-ink text-ink hover:bg-ink hover:text-paper"}`}
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
    <div className="flex border border-ink">
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
  return <p className="font-sign text-2xl tracking-[-0.03em] text-ink">{children}</p>;
}
