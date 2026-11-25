alter type plan rename value 'counter' to 'free';
alter type plan rename value 'desk' to 'pro';
alter table workspaces alter column plan set default 'free';
