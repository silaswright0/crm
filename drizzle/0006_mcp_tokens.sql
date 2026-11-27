create table mcp_tokens (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null,
  created_at timestamptz not null default now()
);
