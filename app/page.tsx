import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { login, signup } from "@/lib/actions";
import { buttonClass, fieldClass, labelClass } from "@/components/ui";

const errors: Record<string, string> = {
  missing: "Name, email, a password, and a workspace name.",
  short: "Use at least 8 characters.",
  taken: "That email already keeps a book. Log in instead.",
  CredentialsSignin: "That email and password do not match a book.",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; error?: string }>;
}) {
  const session = await auth();
  if (session?.user?.workspaceId) redirect("/counter");

  const params = await searchParams;
  const mode = params.mode === "signup" ? "signup" : "login";
  const error = params.error ? errors[params.error] : undefined;

  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="flex flex-col justify-between bg-sign px-8 py-10 text-paper sm:px-12">
        <p className="text-[11px] uppercase tracking-[0.22em] text-sign-muted">The counter</p>
        <div>
          <h1 className="font-sign text-6xl leading-none tracking-tight sm:text-7xl">Daybook</h1>
          <p className="mt-6 max-w-sm font-sign text-2xl leading-snug text-[#f4efe6]">
            Keep the people you are selling, and the ones you just won.
          </p>
          <div className="mt-8 h-px w-16 bg-lacquer" />
        </div>
        <p className="max-w-xs text-sm leading-6 text-sign-muted">
          A book for people and organizations, with a board for the sale and a board for what happens after the yes.
        </p>
      </section>
      <section className="flex items-center bg-paper px-8 py-12 sm:px-12">
        <div className="w-full max-w-sm">
          <div className="flex gap-4 text-[11px] uppercase tracking-[0.16em]">
            <Link href="/" className={mode === "login" ? "text-ink" : "text-muted"}>
              Log in
            </Link>
            <Link href="/?mode=signup" className={mode === "signup" ? "text-ink" : "text-muted"}>
              Open a workspace
            </Link>
          </div>
          {error ? <p className="mt-4 text-sm text-lacquer">{error}</p> : null}
          {mode === "signup" ? (
            <form action={signup} className="mt-6 space-y-4">
              <Field name="name" label="Your name" autoComplete="name" />
              <Field name="email" label="Email" type="email" autoComplete="email" />
              <Field name="password" label="Password" type="password" autoComplete="new-password" />
              <Field name="workspace" label="Workspace" autoComplete="organization" />
              <button type="submit" className={buttonClass}>
                Open the book
              </button>
            </form>
          ) : (
            <form action={login} className="mt-6 space-y-4">
              <Field name="email" label="Email" type="email" autoComplete="email" />
              <Field name="password" label="Password" type="password" autoComplete="current-password" />
              <button type="submit" className={buttonClass}>
                Enter
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}

function Field({
  name,
  label,
  type = "text",
  autoComplete,
}: {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <input name={name} type={type} required autoComplete={autoComplete} className={fieldClass} />
    </label>
  );
}
