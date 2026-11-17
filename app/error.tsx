"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col bg-sign px-6 py-8 text-paper sm:px-10">
      <p className="font-mono text-[11px] text-sign-muted">The book stopped</p>
      <h1 className="mt-10 max-w-3xl font-sign text-[clamp(3.5rem,10vw,7rem)] leading-[0.82] tracking-[-0.05em]">
        This page did not come up.
      </h1>
      <p className="mt-4 max-w-sm text-sm leading-6 text-sign-muted">
        Try it once more. If it stays down, go back to the counter.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="border-2 border-paper bg-paper px-3 py-2 text-sm text-sign"
        >
          Try again
        </button>
        <Link href="/counter" className="border-2 border-paper px-3 py-2 text-sm hover:bg-paper hover:text-sign">
          Back to the counter
        </Link>
      </div>
    </main>
  );
}
