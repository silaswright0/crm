import { createStageAutomation, createWebhookAutomation, deleteAutomation } from "@/lib/actions";
import { listAutomationStages, listAutomations } from "@/lib/db/queries";
import { hookUrl } from "@/lib/desk";
import { requireWorkspace } from "@/lib/session";
import { DeskGate } from "@/components/desk";
import { PageHeader, buttonClass, fieldClass, ghostClass, labelClass } from "@/components/ui";

export default async function AutomationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { workspace } = await requireWorkspace();
  const params = await searchParams;
  const paid = workspace.plan === "pro";
  const [rules, stageChoices] = await Promise.all([
    listAutomations(workspace.id),
    listAutomationStages(workspace.id),
  ]);

  return (
    <div>
      <PageHeader
        title="Automations"
        lede="One rule sends one email. A stage sends it when a card arrives. A webhook sends it when another system calls this book."
      />
      <DeskGate locked={!paid}>
        {params.error === "hooks" ? (
          <p className="mb-6 text-sm text-lacquer">Only 128 webhook automations per org.</p>
        ) : null}
        {params.error === "delay" ? (
          <p className="mb-6 text-sm text-lacquer">Wait is whole days and hours, up to 90 days.</p>
        ) : null}
        <ul className="divide-y divide-line border-y border-line">
          {rules.length === 0 ? <li className="py-4 text-sm text-muted">No rules yet.</li> : null}
          {rules.map((rule) => (
            <li key={rule.id} className="grid gap-3 py-4 sm:grid-cols-[1fr_auto] sm:items-start">
              <div>
                <p className="font-sign text-2xl leading-none tracking-[-0.03em]">{rule.name}</p>
                <p className="mt-2 text-sm text-muted">{whenRule(rule)}</p>
                <p className="mt-2 text-sm">{rule.subject}</p>
                {rule.triggerKind === "webhook" && rule.webhookToken ? (
                  <div className="mt-2 space-y-1">
                    <p className="break-all font-mono text-[11px] text-muted">{hookUrl(rule.webhookToken)}</p>
                    <p className="font-mono text-[11px] text-muted">{`POST { "email": "ada@example.com" }`}</p>
                  </div>
                ) : null}
              </div>
              <form action={deleteAutomation}>
                <input type="hidden" name="id" value={rule.id} />
                <button type="submit" disabled={!paid} className={ghostClass}>
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
        <div className="mt-10 grid gap-10 lg:grid-cols-2">
          <form action={createStageAutomation} className="space-y-3">
            <h2 className="font-sign text-2xl tracking-[-0.03em]">When a card enters a stage</h2>
            <fieldset disabled={!paid} className="space-y-3">
              <Field name="name" label="Name" placeholder="After the first conversation" />
              <label className="block">
                <span className={labelClass}>Stage</span>
                <select name="stageId" required className={fieldClass} defaultValue="">
                  <option value="" disabled>
                    Choose a stage
                  </option>
                  {stageChoices.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.pipelineName} · {stage.name}
                    </option>
                  ))}
                </select>
              </label>
              <Field name="delayDays" label="Wait, in days" placeholder="0" type="number" min={0} max={90} step={1} />
              <Field name="delayHours" label="Wait, in hours" placeholder="0" type="number" min={0} max={23} step={1} />
              <Field name="subject" label="Subject" placeholder="Good to meet you" />
              <BodyField />
              <button type="submit" className={buttonClass}>
                Save the rule
              </button>
            </fieldset>
          </form>
          <form action={createWebhookAutomation} className="space-y-3">
            <h2 className="font-sign text-2xl tracking-[-0.03em]">When a webhook arrives</h2>
            <fieldset disabled={!paid} className="space-y-3">
              <Field name="name" label="Name" placeholder="A form on your site" />
              <Field name="delayDays" label="Wait, in days" placeholder="0" type="number" min={0} max={90} step={1} />
              <Field name="delayHours" label="Wait, in hours" placeholder="0" type="number" min={0} max={23} step={1} />
              <Field name="subject" label="Subject" placeholder="We got your note" />
              <BodyField />
              <button type="submit" className={buttonClass}>
                Save the rule
              </button>
            </fieldset>
            <p className="text-sm leading-6 text-muted">Only 128 webhook automations per org.</p>
            <pre className="overflow-x-auto border border-line p-3 font-mono text-[11px] leading-5 text-muted">{`POST /api/hooks/…
{ "email": "ada@example.com" }`}</pre>
          </form>
        </div>
      </DeskGate>
    </div>
  );
}

function waitPhrase(totalHours: number) {
  if (totalHours === 0) return "on the next hour";
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const parts = [
    days === 1 ? "1 day" : days > 1 ? `${days} days` : "",
    hours === 1 ? "1 hour" : hours > 1 ? `${hours} hours` : "",
  ].filter(Boolean);
  return `after ${parts.join(" and ")}`;
}

function whenRule(rule: {
  triggerKind: "stage" | "webhook";
  pipelineName: string | null;
  stageName: string | null;
  delayHours: number;
}) {
  const wait = waitPhrase(rule.delayHours);
  if (rule.triggerKind === "webhook") return `When a webhook arrives, email them ${wait}.`;
  if (!rule.stageName) return `The stage is gone. Nothing will send.`;
  return `When a card enters ${rule.pipelineName} · ${rule.stageName}, email the person ${wait}.`;
}

function Field({
  name,
  label,
  placeholder,
  type = "text",
  min,
  max,
  step,
}: {
  name: string;
  label: string;
  placeholder: string;
  type?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <input
        name={name}
        type={type}
        min={min}
        max={max}
        step={step}
        required={name !== "delayDays" && name !== "delayHours"}
        placeholder={placeholder}
        className={fieldClass}
      />
    </label>
  );
}

function BodyField() {
  return (
    <label className="block">
      <span className={labelClass}>Letter</span>
      <textarea name="body" required rows={4} className={fieldClass} placeholder="The note, in this book’s voice." />
    </label>
  );
}
