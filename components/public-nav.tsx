import Link from "next/link";

export const publicFeatures = [
  { slug: "home", label: "Home" },
  { slug: "book", label: "Book" },
  { slug: "mail", label: "Mail" },
  { slug: "automations", label: "Automations" },
  { slug: "mcp", label: "MCP" },
] as const;

export type FeatureSlug = (typeof publicFeatures)[number]["slug"];

export function featureHref(slug: string) {
  return `/features/${slug}`;
}

export function PublicNav({ current }: { current?: FeatureSlug }) {
  return (
    <nav aria-label="Features" className="flex max-w-full flex-wrap items-baseline justify-end font-mono text-[11px] text-sign-muted">
      {publicFeatures.map((feature, index) => {
        const href = featureHref(feature.slug);
        const active = current === feature.slug;
        return (
          <span key={feature.slug}>
            {index === 0 ? null : ", "}
            <Link href={href} aria-current={active ? "page" : undefined} className={active ? "text-paper" : "hover:text-paper"}>
              {feature.label}
            </Link>
          </span>
        );
      })}
    </nav>
  );
}
