alter table messages add column external_id text;

create unique index messages_workspace_external_id on messages (workspace_id, external_id);
