import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-paper px-6">
      <div className="max-w-md">
        <h1 className="font-sign text-5xl tracking-tight">Not on the book.</h1>
        <p className="mt-3 text-sm text-muted">That page is not part of this workspace.</p>
        <Link href="/counter" className="mt-6 inline-block text-sm text-lacquer">
          Back to the counter
        </Link>
      </div>
    </main>
  );
}
