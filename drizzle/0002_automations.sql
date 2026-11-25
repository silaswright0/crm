create type automation_trigger as enum ('stage', 'webhook');

create table automations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  trigger_kind automation_trigger not null,
  stage_id uuid references stages(id) on delete set null,
  delay_days integer not null default 0,
  subject text not null,
  body text not null,
  webhook_token text unique,
  created_at timestamptz not null default now()
);
