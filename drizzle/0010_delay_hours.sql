alter table automations rename column delay_days to delay_hours;
update automations set delay_hours = delay_hours * 24;
