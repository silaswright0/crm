import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { login, signup } from "@/lib/actions";
import { PublicNav } from "@/components/public-nav";
import { buttonClass, fieldClass, labelClass } from "@/components/ui";

const errors: Record<string, string> = {
  missing: "Name, a password, and a workspace name.",
  email: "Use an email address.",
  taken: "That email already keeps a book. Log in instead.",
  CredentialsSignin: "That email and password do not match a book.",
  opened: "The book is open. Log in with that email.",
  unavailable: "The book could not be opened. Try again.",
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
    <main className="flex min-h-dvh flex-col bg-paper">
      <section className="overflow-hidden bg-sign text-paper">
        <div className="mx-auto flex max-w-6xl justify-end px-6 pt-6 sm:px-10">
          <PublicNav />
        </div>
        <h1 className="mx-auto max-w-6xl px-6 pb-20 pt-6 font-sign text-[clamp(5rem,18vw,10.5rem)] leading-[0.76] tracking-[-0.06em] sm:px-10">
          MusterLog
        </h1>
      </section>
      <section className="mx-auto flex max-w-6xl flex-col items-start gap-10 px-6 py-10 sm:px-10">
        <div className="max-w-md">
          <p className="font-sign text-[2rem] leading-[1.05] tracking-[-0.035em]">
            Keep the people you are selling, and the ones you just won.
          </p>
          <p className="mt-4 text-sm leading-6 text-muted">
            A book for people and organizations, with a board for the sale and a board for what happens after the yes.
          </p>
        </div>
        <div className="w-full max-w-sm border-2 border-sign bg-paper p-5 shadow-[7px_7px_0_#102033]">
          <div className="flex gap-5 text-sm">
            <Link href="/" className={mode === "login" ? "border-b-2 border-ink pb-0.5" : "text-muted"}>
              Log in
            </Link>
            <Link href="/?mode=signup" className={mode === "signup" ? "border-b-2 border-ink pb-0.5" : "text-muted"}>
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
