"use client";

import { useEffect } from "react";
import { Bricolage_Grotesque, IBM_Plex_Mono, Public_Sans } from "next/font/google";
import "./globals.css";

const sans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-public",
});

const sign = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex",
});

export default function GlobalError({
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
    <html lang="en" className={`${sans.variable} ${sign.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <main className="flex min-h-dvh flex-col bg-sign px-6 py-8 text-paper sm:px-10">
          <p className="font-mono text-[11px] text-sign-muted">The book stopped</p>
          <h1 className="mt-10 max-w-3xl font-sign text-[clamp(3.5rem,10vw,7rem)] leading-[0.82] tracking-[-0.05em]">
            MusterLog did not come up.
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-6 text-sign-muted">Try it once more.</p>
          <button
            type="button"
            onClick={() => retry()}
            className="mt-8 w-fit border-2 border-paper bg-paper px-3 py-2 text-sm text-sign"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
