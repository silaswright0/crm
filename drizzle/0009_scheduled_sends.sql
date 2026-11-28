create table scheduled_sends (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  automation_id uuid not null references automations(id) on delete cascade,
  to_address text not null,
  subject text not null,
  body text not null,
  due_at timestamptz not null,
  claimed_at timestamptz,
  sent_at timestamptz,
  abandoned_at timestamptz,
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now()
);

create index scheduled_sends_due on scheduled_sends (due_at)
  where sent_at is null and abandoned_at is null;
