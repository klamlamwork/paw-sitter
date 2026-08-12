alter table public.sitter_weekly_availability
  add column if not exists service_scope text not null default 'default';

update public.sitter_weekly_availability
set service_scope = 'default'
where service_scope is null or service_scope = '';

do $$
begin
  alter table public.sitter_weekly_availability
    drop constraint if exists sitter_weekly_availability_sitter_id_day_of_week_key;
exception when undefined_object then null;
end $$;

alter table public.sitter_weekly_availability
  drop constraint if exists sitter_weekly_scope_check;

alter table public.sitter_weekly_availability
  add constraint sitter_weekly_scope_check
  check (service_scope in ('default', 'drop_in', 'walking'));

drop index if exists sitter_weekly_avail_scope_uidx;
create unique index if not exists sitter_weekly_avail_scope_uidx
  on public.sitter_weekly_availability (sitter_id, day_of_week, service_scope);

notify pgrst, 'reload schema';
