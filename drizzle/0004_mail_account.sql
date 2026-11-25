create table mail_accounts (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  host text not null,
  port integer not null default 587,
  username text,
  password text not null default '',
  from_address text not null,
  updated_at timestamptz not null default now()
);
