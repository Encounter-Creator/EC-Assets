create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists assets_set_updated_at on public.assets;
create trigger assets_set_updated_at
before update on public.assets
for each row
execute function public.set_updated_at();

drop trigger if exists request_drafts_set_updated_at on public.request_drafts;
create trigger request_drafts_set_updated_at
before update on public.request_drafts
for each row
execute function public.set_updated_at();

drop trigger if exists requests_set_updated_at on public.requests;
create trigger requests_set_updated_at
before update on public.requests
for each row
execute function public.set_updated_at();

drop trigger if exists approvals_set_updated_at on public.approvals;
create trigger approvals_set_updated_at
before update on public.approvals
for each row
execute function public.set_updated_at();

drop trigger if exists return_requests_set_updated_at on public.return_requests;
create trigger return_requests_set_updated_at
before update on public.return_requests
for each row
execute function public.set_updated_at();

drop trigger if exists damage_cases_set_updated_at on public.damage_cases;
create trigger damage_cases_set_updated_at
before update on public.damage_cases
for each row
execute function public.set_updated_at();

create or replace function public.current_user_role()
returns public.app_role
language sql
stable
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_manager_or_admin()
returns boolean
language sql
stable
as $$
  select coalesce(public.current_user_role() in ('admin', 'asset_manager'), false)
$$;

alter table public.profiles enable row level security;
alter table public.assets enable row level security;
alter table public.request_drafts enable row level security;
alter table public.requests enable row level security;
alter table public.approvals enable row level security;
alter table public.return_requests enable row level security;
alter table public.damage_cases enable row level security;
alter table public.notifications enable row level security;
alter table public.push_tokens enable row level security;

drop policy if exists profiles_self_or_manager_read on public.profiles;
create policy profiles_self_or_manager_read
on public.profiles
for select
using (id = auth.uid() or public.is_manager_or_admin());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update
on public.profiles
for update
using (id = auth.uid() or public.is_manager_or_admin())
with check (id = auth.uid() or public.is_manager_or_admin());

drop policy if exists notifications_owner_read on public.notifications;
create policy notifications_owner_read
on public.notifications
for select
using (user_id = auth.uid() or public.is_manager_or_admin());

drop policy if exists notifications_owner_update on public.notifications;
create policy notifications_owner_update
on public.notifications
for update
using (user_id = auth.uid() or public.is_manager_or_admin())
with check (user_id = auth.uid() or public.is_manager_or_admin());

drop policy if exists drafts_owner_manage on public.request_drafts;
create policy drafts_owner_manage
on public.request_drafts
for all
using (requested_by = auth.uid() or public.is_manager_or_admin())
with check (requested_by = auth.uid() or public.is_manager_or_admin());

drop policy if exists requests_owner_or_manager_read on public.requests;
create policy requests_owner_or_manager_read
on public.requests
for select
using (requested_by = auth.uid() or public.is_manager_or_admin());

drop policy if exists approvals_manager_read on public.approvals;
create policy approvals_manager_read
on public.approvals
for select
using (public.is_manager_or_admin() or assigned_to = auth.uid());

drop policy if exists returns_owner_or_manager_read on public.return_requests;
create policy returns_owner_or_manager_read
on public.return_requests
for select
using (
  public.is_manager_or_admin()
  or exists (
    select 1 from public.requests r
    where r.id = return_requests.request_id and r.requested_by = auth.uid()
  )
);

drop policy if exists damage_owner_or_manager_read on public.damage_cases;
create policy damage_owner_or_manager_read
on public.damage_cases
for select
using (responsible_user_id = auth.uid() or public.is_manager_or_admin());

drop policy if exists push_tokens_owner_manage on public.push_tokens;
create policy push_tokens_owner_manage
on public.push_tokens
for all
using (user_id = auth.uid() or public.is_manager_or_admin())
with check (user_id = auth.uid() or public.is_manager_or_admin());

create or replace function public.get_my_access_context()
returns table (
  approved boolean,
  locked boolean,
  role public.app_role,
  home_base text,
  department text,
  full_name text,
  email text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.approved,
    p.locked,
    p.role,
    l.name as home_base,
    d.name as department,
    p.full_name,
    p.email
  from public.profiles p
  left join public.locations l on l.id = p.home_base_id
  left join public.departments d on d.id = p.department_id
  where p.id = auth.uid()
$$;

create or replace function public.save_request_draft(
  p_workflow_type text,
  p_source_location_id uuid,
  p_payload jsonb
)
returns public.request_drafts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft public.request_drafts;
begin
  insert into public.request_drafts (requested_by, workflow_type, source_location_id, payload, status)
  values (auth.uid(), p_workflow_type, p_source_location_id, coalesce(p_payload, '{}'::jsonb), 'Draft')
  on conflict (requested_by, workflow_type) where status = 'Draft'
  do update
    set source_location_id = excluded.source_location_id,
        payload = excluded.payload,
        updated_at = now()
  returning * into v_draft;

  return v_draft;
end;
$$;

create or replace function public.submit_request_from_draft(p_draft_id uuid)
returns public.requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft public.request_drafts;
  v_request public.requests;
begin
  select * into v_draft
  from public.request_drafts
  where id = p_draft_id and requested_by = auth.uid() and status = 'Draft';

  if not found then
    raise exception 'Draft not found';
  end if;

  insert into public.requests (requested_by, workflow_type, source_location_id, status, payload)
  values (v_draft.requested_by, v_draft.workflow_type, v_draft.source_location_id, 'Pending', v_draft.payload)
  returning * into v_request;

  update public.request_drafts
  set status = 'Completed'
  where id = v_draft.id;

  return v_request;
end;
$$;

create or replace function public.register_push_token(
  p_expo_token text,
  p_platform text default null
)
returns public.push_tokens
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token public.push_tokens;
begin
  insert into public.push_tokens (user_id, expo_token, platform, last_seen_at)
  values (auth.uid(), p_expo_token, p_platform, now())
  on conflict (expo_token)
  do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        last_seen_at = now()
  returning * into v_token;

  return v_token;
end;
$$;

create or replace function public.queue_notification(
  p_user_id uuid,
  p_category public.notification_category,
  p_title text,
  p_body text,
  p_urgent boolean default false,
  p_action_url text default null,
  p_email text default null,
  p_push_tokens text[] default null
)
returns public.notifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notification public.notifications;
  v_token text;
begin
  insert into public.notifications (user_id, category, title, body, action_url, urgent)
  values (p_user_id, p_category, p_title, p_body, p_action_url, coalesce(p_urgent, false))
  returning * into v_notification;

  insert into public.notification_deliveries (notification_id, channel, recipient, status)
  values (v_notification.id, 'in_app', p_user_id::text, 'delivered');

  if p_email is not null and length(trim(p_email)) > 0 then
    insert into public.notification_deliveries (notification_id, channel, recipient, status)
    values (v_notification.id, 'email', p_email, 'queued');
  end if;

  if p_push_tokens is not null then
    foreach v_token in array p_push_tokens loop
      insert into public.notification_deliveries (notification_id, channel, recipient, status)
      values (v_notification.id, 'push', v_token, 'queued');
    end loop;
  end if;

  return v_notification;
end;
$$;

create or replace function public.submit_damage_form(
  p_case_id uuid,
  p_statement text
)
returns public.damage_cases
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case public.damage_cases;
begin
  update public.damage_cases
  set user_statement = p_statement,
      status = 'Form Submitted'
  where id = p_case_id and responsible_user_id = auth.uid()
  returning * into v_case;

  if not found then
    raise exception 'Damage case not found';
  end if;

  update public.profiles
  set locked = false
  where id = auth.uid();

  return v_case;
end;
$$;

create or replace function public.resolve_damage_case(
  p_case_id uuid,
  p_resolved_state public.asset_state,
  p_condition_note text default null
)
returns public.damage_cases
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case public.damage_cases;
  v_status public.damage_status;
begin
  if not public.is_manager_or_admin() then
    raise exception 'Not authorized';
  end if;

  v_status := case
    when p_resolved_state = 'Available' then 'Resolved: Available'::public.damage_status
    when p_resolved_state = 'Damaged' then 'Resolved: Damaged'::public.damage_status
    else 'Resolved: Lost'::public.damage_status
  end;

  update public.damage_cases
  set resolved_state = p_resolved_state,
      status = v_status
  where id = p_case_id
  returning * into v_case;

  if not found then
    raise exception 'Damage case not found';
  end if;

  update public.assets
  set state = p_resolved_state,
      condition_note = coalesce(p_condition_note, condition_note)
  where id = v_case.asset_id;

  return v_case;
end;
$$;
