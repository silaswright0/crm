create type plan as enum ('counter', 'desk');
create type pipeline_kind as enum ('sales', 'onboarding');
create type stage_kind as enum ('open', 'won', 'lost', 'done');
create type activity_kind as enum ('note', 'stage_change', 'created');

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan plan not null default 'counter',
  created_at timestamptz not null default now()
);

create table users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password_hash text not null,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table organizations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  domain text,
  industry text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table people (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  organization_id uuid references organizations(id) on delete set null,
  name text not null,
  email text,
  phone text,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table pipelines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  kind pipeline_kind not null,
  name text not null,
  unique (workspace_id, kind)
);

create table stages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  pipeline_id uuid not null references pipelines(id) on delete cascade,
  name text not null,
  position integer not null,
  kind stage_kind not null
);

create table cards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  pipeline_id uuid not null references pipelines(id) on delete cascade,
  stage_id uuid not null references stages(id),
  organization_id uuid not null references organizations(id),
  person_id uuid references people(id) on delete set null,
  title text not null,
  value_cents integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table checklist_items (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references cards(id) on delete cascade,
  label text not null,
  done boolean not null default false,
  position integer not null
);

create table activities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  card_id uuid references cards(id) on delete cascade,
  person_id uuid references people(id) on delete cascade,
  organization_id uuid references organizations(id) on delete cascade,
  kind activity_kind not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table next_actions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  card_id uuid references cards(id) on delete cascade,
  person_id uuid references people(id) on delete cascade,
  organization_id uuid references organizations(id) on delete cascade,
  text text not null,
  due_on date not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index people_workspace_idx on people (workspace_id);
create index organizations_workspace_idx on organizations (workspace_id);
create index cards_workspace_idx on cards (workspace_id);
create index cards_stage_idx on cards (stage_id);
create index activities_workspace_idx on activities (workspace_id);
create index activities_card_idx on activities (card_id);
create index activities_person_idx on activities (person_id);
create index activities_org_idx on activities (organization_id);
create index next_actions_workspace_idx on next_actions (workspace_id);
