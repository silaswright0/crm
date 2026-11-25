create type mail_direction as enum ('in', 'out');

create table messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  direction mail_direction not null,
  from_address text not null,
  to_address text not null,
  subject text not null,
  body text not null,
  person_id uuid references people(id) on delete set null,
  delivered boolean not null default false,
  created_at timestamptz not null default now()
);
