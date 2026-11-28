import Link from "next/link";
import { disconnectGoogleMail, saveMailAccount, sendMail } from "@/lib/actions";
import { getMailAccount, listMessages, listPeople } from "@/lib/db/queries";
import { googleMailConfigured, googleRedirectUri } from "@/lib/google-mail";
import { isMailProblem, mailDeliveryFor, mailProblems, shownMailProblem, syncMailbox } from "@/lib/mail";
import { formatWhen } from "@/lib/format";
import { requireWorkspace } from "@/lib/session";
import { DeskGate } from "@/components/desk";
import { PageHeader, buttonClass, fieldClass, ghostClass, labelClass } from "@/components/ui";

export default async function MailPage({
  searchParams,
}: {
  searchParams: Promise<{ box?: string; letter?: string; error?: string; google?: string }>;
}) {
  const { workspace } = await requireWorkspace();
  const params = await searchParams;
  const paid = workspace.plan === "pro";
  const [account, delivery] = await Promise.all([
    getMailAccount(workspace.id),
    mailDeliveryFor(workspace.id),
  ]);
  const from = delivery?.fromAddress ?? null;

  if (!from) {
    return (
      <div>
        <PageHeader title="Mail" lede="Sign in with Google, or save a mail host." />
        {paid ? (
          <>
            <GoogleConnect email={account?.googleEmail ?? null} notice={params.google} paid />
            <div className="mb-8 border-l-4 border-lacquer pl-4">
              <p className="font-mono text-[11px] text-lacquer">Host required</p>
              <p className="mt-2 max-w-xl text-sm leading-6">
                Inbox, Sent, and Write open after Google is connected, or after the host, port, and from address are saved.
              </p>
            </div>
            <HostForm account={account} paid />
          </>
        ) : (
          <DeskGate locked>
            <HostForm account={account} paid={false} />
          </DeskGate>
        )}
      </div>
    );
  }

  const box = params.box === "sent" || params.box === "write" || params.box === "config" ? params.box : "inbox";
  const direction = box === "sent" ? "out" : "in";
  const synced =
    paid && (box === "inbox" || box === "sent") && !params.letter ? await syncMailbox(workspace.id) : { ok: true as const };
  const mailboxNote = synced.ok ? null : shownMailProblem(synced.problem);
  const sendProblem = params.error && isMailProblem(params.error) ? mailProblems[params.error] : null;
  const listed =
    box === "write" || box === "config" ? [] : await listMessages(workspace.id, direction);
  const letters = box === "sent" ? listed.filter((letter) => letter.delivered) : listed;
  const open = letters.find((letter) => letter.id === params.letter) ?? letters[0] ?? null;
  const people = box === "write" ? await listPeople(workspace.id) : [];

  return (
    <div>
      <PageHeader title="Mail" lede={`Letters for this book. Outbound leaves from ${from}.`} />
      <DeskGate locked={!paid}>
        <div className="mb-4 flex gap-2">
          <Folder href="/mail" label="Inbox" active={box === "inbox"} />
          <Folder href="/mail?box=sent" label="Sent" active={box === "sent"} />
          <Folder href="/mail?box=write" label="Write" active={box === "write"} />
          <Folder href="/mail?box=config" label="Config" active={box === "config"} />
        </div>
        {box === "config" ? (
          <div className="space-y-8">
            <GoogleConnect email={account?.googleEmail ?? null} notice={params.google} paid={paid} />
            <HostForm account={account} paid={paid} />
          </div>
        ) : box === "write" ? (
          <form action={sendMail} className="max-w-xl space-y-3">
            {sendProblem ? <MailProblemNote problem={sendProblem} /> : null}
            <fieldset disabled={!paid} className="space-y-3">
              <label className="block">
                <span className={labelClass}>To</span>
                <input name="to" type="email" required list="book-emails" placeholder="ada@northglass.studio" className={fieldClass} />
                <datalist id="book-emails">
                  {people.map((person) =>
                    person.email ? (
                      <option key={person.id} value={person.email}>
                        {person.name}
                      </option>
                    ) : null,
                  )}
                </datalist>
              </label>
              <label className="block">
                <span className={labelClass}>Subject</span>
                <input name="subject" required className={fieldClass} />
              </label>
              <label className="block">
                <span className={labelClass}>Letter</span>
                <textarea name="body" required rows={8} className={fieldClass} />
              </label>
              <button type="submit" className={buttonClass}>
                Send
              </button>
            </fieldset>
          </form>
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[18rem_1fr]">
            <ul className="divide-y divide-line border-y border-line">
              {mailboxNote ? (
                <li className="py-4">
                  <MailProblemNote problem={mailboxNote} />
                  {!synced.ok && (synced.problem === "second-factor" || synced.problem === "google" || synced.problem === "google-scope") ? (
                    <GoogleSignIn className="mt-3" />
                  ) : null}
                </li>
              ) : null}
              {letters.length === 0 && !mailboxNote ? (
                <li className="py-4 text-sm text-muted">{box === "sent" ? "Nothing sent yet." : "The inbox is empty."}</li>
              ) : null}
              {letters.map((letter) => {
                const active = open?.id === letter.id;
                const who = box === "sent" ? letter.toAddress : letter.fromAddress;
                return (
                  <li key={letter.id}>
                    <Link
                      href={`/mail?box=${box}&letter=${letter.id}`}
                      className={`block py-3 ${active ? "text-ink" : "text-muted hover:text-ink"}`}
                    >
                      <span className="block text-sm text-ink">{letter.subject}</span>
                      <span className="mt-1 block text-xs">
                        {who} · {formatWhen(letter.createdAt)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            {open ? (
              <article>
                <h2 className="font-sign text-3xl leading-none tracking-[-0.03em]">{open.subject}</h2>
                <p className="mt-3 text-sm text-muted">
                  {open.fromAddress} to {open.toAddress}
                </p>
                <p className="mt-6 max-w-xl whitespace-pre-wrap text-sm leading-6">{open.body}</p>
              </article>
            ) : null}
          </div>
        )}
      </DeskGate>
    </div>
  );
}

function GoogleConnect({ email, notice, paid }: { email: string | null; notice?: string; paid: boolean }) {
  return (
    <div className="max-w-xl space-y-3">
      <GoogleNotice notice={notice} />
      {email ? (
        <p className="text-sm leading-6">Signed in as {email}. Inbox and sending use this Google account.</p>
      ) : (
        <p className="text-sm leading-6 text-muted">
          Google’s page asks for the password and the second factor. This book keeps a token, not the code.
        </p>
      )}
      {paid ? (
        <div className="flex flex-wrap gap-2">
          <GoogleSignIn />
          {email ? (
            <form action={disconnectGoogleMail}>
              <button type="submit" className={ghostClass}>
                Disconnect Google
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function GoogleSignIn({ className = "" }: { className?: string }) {
  if (!googleMailConfigured()) {
    return (
      <p className={`max-w-xl text-sm leading-6 text-lacquer ${className}`}>
        Google sign-in needs a client id and secret on this server. The redirect URI is {googleRedirectUri()}.
      </p>
    );
  }
  return (
    <a href="/api/google/mail" className={`${buttonClass} inline-block ${className}`}>
      Sign in with Google
    </a>
  );
}

function GoogleNotice({ notice }: { notice?: string }) {
  if (notice === "connected") return <p className="text-sm leading-6">Google is connected. Inbox and sending use that account.</p>;
  const text =
    notice === "denied"
      ? "Google sign-in was cancelled."
      : notice === "token"
        ? "Google did not grant a lasting sign-in. Try again."
        : notice === "state"
          ? "Google sign-in expired. Try again."
          : notice === "config"
            ? "Google sign-in needs a client id and secret on this server."
            : notice === "scope"
              ? "Google signed you in, but it did not allow mailbox access. In Google Auth Platform, open Data Access, add https://mail.google.com/, then use Sign in with Google again."
              : null;
  if (!text) return null;
  return <p className="text-sm leading-6 text-lacquer">{text}</p>;
}

function HostForm({
  account,
  paid,
}: {
  account: {
    host: string;
    port: number;
    username: string | null;
    fromAddress: string;
    hasPassword: boolean;
  } | null;
  paid: boolean;
}) {
  return (
    <form action={saveMailAccount} className="max-w-xl space-y-3">
      <fieldset disabled={!paid} className="space-y-3">
        <label className="block">
          <span className={labelClass}>Host</span>
          <input name="host" required defaultValue={account?.host ?? ""} placeholder="smtp.example.com" className={fieldClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Port</span>
          <input name="port" required inputMode="numeric" defaultValue={account?.port ?? 587} className={fieldClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Username</span>
          <input name="username" defaultValue={account?.username ?? ""} className={fieldClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Password</span>
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder={account?.hasPassword ? "Saved. Leave blank to keep it." : ""}
            className={fieldClass}
          />
        </label>
        <label className="block">
          <span className={labelClass}>From</span>
          <input
            name="fromAddress"
            required
            defaultValue={account?.fromAddress ?? ""}
            placeholder="MusterLog <mail@example.com>"
            className={fieldClass}
          />
        </label>
        <button type="submit" className={buttonClass}>
          Save the host
        </button>
      </fieldset>
    </form>
  );
}

function MailProblemNote({ problem }: { problem: { label: string; text: string } }) {
  return (
    <p className="text-sm leading-6 text-lacquer">
      <span className="font-medium">{problem.label}.</span> {problem.text}
    </p>
  );
}

function Folder({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`px-3 py-1.5 text-sm ${active ? "bg-ink text-paper" : "border border-ink text-ink hover:bg-ink hover:text-paper"}`}
    >
      {label}
    </Link>
  );
}
