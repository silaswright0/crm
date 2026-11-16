import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col bg-sign px-6 py-8 text-paper sm:px-10">
      <p className="font-mono text-[11px] text-sign-muted">404</p>
      <h1 className="mt-10 max-w-3xl font-sign text-[clamp(3.5rem,10vw,7rem)] leading-[0.82] tracking-[-0.05em]">
        Not on the book.
      </h1>
      <p className="mt-4 max-w-sm text-sm leading-6 text-sign-muted">That page is not part of this workspace.</p>
      <Link href="/counter" className="mt-8 inline-block w-fit border-2 border-paper px-3 py-2 text-sm hover:bg-paper hover:text-sign">
        Back to the counter
      </Link>
    </main>
  );
}
