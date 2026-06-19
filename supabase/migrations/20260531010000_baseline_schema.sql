create extension if not exists pgcrypto;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text null,
  display_name text null,
  surname text null,
  full_name text null,
  assigned_location_id uuid null,
  asset_manager_location_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('main_admin', 'admin', 'asset_manager', 'staff', 'volunteer')),
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  is_home_base boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add constraint profiles_assigned_location_id_fkey
  foreign key (assigned_location_id) references public.locations(id) on delete set null;

alter table public.profiles
  add constraint profiles_asset_manager_location_id_fkey
  foreign key (asset_manager_location_id) references public.locations(id) on delete set null;

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  code text null unique,
  tag text null,
  name text null,
  serial_number text null,
  status text not null default 'available',
  state text not null default 'available',
  current_location_id uuid null references public.locations(id) on delete set null,
  department_id uuid null references public.departments(id) on delete set null,
  current_holder uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.asset_history (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  action text not null,
  notes text null,
  performed_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references public.profiles(id) on delete cascade,
  workflow_type text not null,
  source_location_id uuid null references public.locations(id) on delete set null,
  status text not null default 'Pending',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  request_id uuid null references public.requests(id) on delete cascade,
  approval_type text not null,
  status text not null default 'Pending',
  assigned_to uuid null references public.profiles(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  review_notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.return_requests (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  preferred_return_location_id uuid null references public.locations(id) on delete set null,
  status text not null default 'Pending',
  note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id)
);

create table if not exists public.asset_request_bundles (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references public.profiles(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete restrict,
  needed_for text null,
  needed_by timestamptz null,
  notes text null,
  status text not null default 'Pending',
  rejection_notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.asset_request_bundle_items (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid not null references public.asset_request_bundles(id) on delete cascade,
  asset_id uuid null references public.assets(id) on delete set null,
  item_description text null,
  fulfilled_asset_id uuid null references public.assets(id) on delete set null,
  source_status text null,
  status text not null default 'Pending',
  skip_note text null,
  created_at timestamptz not null default now()
);

create table if not exists public.handovers (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles(id) on delete cascade,
  to_user uuid not null references public.profiles(id) on delete cascade,
  notes text null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.handover_items (
  id uuid primary key default gen_random_uuid(),
  handover_id uuid not null references public.handovers(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (handover_id, asset_id)
);

create table if not exists public.damage_cases (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid null references public.assets(id) on delete set null,
  responsible_user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'Form Pending',
  user_statement text null,
  condition_note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.damage_reports (
  id uuid primary key default gen_random_uuid(),
  assigned_to uuid not null references public.profiles(id) on delete cascade,
  asset_code text null,
  asset_name text null,
  status text not null default 'pending',
  damage_type text null,
  description text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kits (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  home_base text null,
  item_count integer not null default 0 check (item_count >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.consumables (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  department text null,
  unit text not null,
  stock_on_hand integer not null default 0 check (stock_on_hand >= 0),
  reorder_level integer not null default 0 check (reorder_level >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_config (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  description text null,
  updated_at timestamptz not null default now()
);

create table if not exists public.duplicates (
  id uuid primary key default gen_random_uuid(),
  primary_asset text not null,
  duplicate_asset text not null,
  status text not null default 'Open',
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assets_current_location_idx on public.assets (current_location_id);
create index if not exists assets_department_idx on public.assets (department_id);
create index if not exists assets_current_holder_idx on public.assets (current_holder);
create index if not exists asset_history_asset_id_idx on public.asset_history (asset_id, created_at desc);
create index if not exists approvals_status_idx on public.approvals (status, created_at desc);
create index if not exists requests_requested_by_idx on public.requests (requested_by, created_at desc);
create index if not exists damage_cases_responsible_idx on public.damage_cases (responsible_user_id, created_at desc);
create index if not exists handovers_to_user_idx on public.handovers (to_user, status, created_at desc);
create index if not exists handovers_from_user_idx on public.handovers (from_user, status, created_at desc);

create or replace function public.sync_asset_state()
returns trigger
language plpgsql
as $$
begin
  if new.status is null or btrim(new.status) = '' then
    new.status = coalesce(new.state, 'available');
  end if;
  new.state = new.status;
  return new;
end;
$$;

drop trigger if exists assets_sync_state on public.assets;
create trigger assets_sync_state
before insert or update on public.assets
for each row
execute function public.sync_asset_state();

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row
execute function public.touch_updated_at();

drop trigger if exists locations_touch_updated_at on public.locations;
create trigger locations_touch_updated_at
before update on public.locations
for each row
execute function public.touch_updated_at();

drop trigger if exists departments_touch_updated_at on public.departments;
create trigger departments_touch_updated_at
before update on public.departments
for each row
execute function public.touch_updated_at();

drop trigger if exists assets_touch_updated_at on public.assets;
create trigger assets_touch_updated_at
before update on public.assets
for each row
execute function public.touch_updated_at();

drop trigger if exists requests_touch_updated_at on public.requests;
create trigger requests_touch_updated_at
before update on public.requests
for each row
execute function public.touch_updated_at();

drop trigger if exists approvals_touch_updated_at on public.approvals;
create trigger approvals_touch_updated_at
before update on public.approvals
for each row
execute function public.touch_updated_at();

drop trigger if exists return_requests_touch_updated_at on public.return_requests;
create trigger return_requests_touch_updated_at
before update on public.return_requests
for each row
execute function public.touch_updated_at();

drop trigger if exists asset_request_bundles_touch_updated_at on public.asset_request_bundles;
create trigger asset_request_bundles_touch_updated_at
before update on public.asset_request_bundles
for each row
execute function public.touch_updated_at();

drop trigger if exists handovers_touch_updated_at on public.handovers;
create trigger handovers_touch_updated_at
before update on public.handovers
for each row
execute function public.touch_updated_at();

drop trigger if exists damage_cases_touch_updated_at on public.damage_cases;
create trigger damage_cases_touch_updated_at
before update on public.damage_cases
for each row
execute function public.touch_updated_at();

drop trigger if exists damage_reports_touch_updated_at on public.damage_reports;
create trigger damage_reports_touch_updated_at
before update on public.damage_reports
for each row
execute function public.touch_updated_at();

drop trigger if exists kits_touch_updated_at on public.kits;
create trigger kits_touch_updated_at
before update on public.kits
for each row
execute function public.touch_updated_at();

drop trigger if exists consumables_touch_updated_at on public.consumables;
create trigger consumables_touch_updated_at
before update on public.consumables
for each row
execute function public.touch_updated_at();

drop trigger if exists duplicates_touch_updated_at on public.duplicates;
create trigger duplicates_touch_updated_at
before update on public.duplicates
for each row
execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do update
  set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

create or replace function public.is_approved(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.user_roles ur on ur.user_id = p.id
    where p.id = _user_id
  );
$$;

create or replace function public.get_my_access_context()
returns table (
  approved boolean,
  roles text[],
  asset_manager_location_id uuid,
  assigned_location_id uuid,
  profile_exists boolean,
  display_name text,
  surname text
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select p.*
    from public.profiles p
    where p.id = auth.uid()
  ),
  my_roles as (
    select array_agg(ur.role order by ur.role) as roles
    from public.user_roles ur
    where ur.user_id = auth.uid()
  )
  select
    coalesce(cardinality(my_roles.roles), 0) > 0 as approved,
    my_roles.roles,
    me.asset_manager_location_id,
    coalesce(me.assigned_location_id, me.asset_manager_location_id) as assigned_location_id,
    me.id is not null as profile_exists,
    me.display_name,
    me.surname
  from my_roles
  full join me on true;
$$;

create or replace function public.list_standard_locations()
returns table (
  id uuid,
  name text
)
language sql
stable
security definer
set search_path = public
as $$
  select l.id, l.name
  from public.locations l
  where l.active = true
  order by l.name asc;
$$;

create or replace function public.list_standard_sign_out_assets()
returns table (
  id uuid,
  tag text,
  name text,
  serial_number text,
  state text,
  current_location text,
  holder text,
  department text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id,
    coalesce(a.code, 'No tag') as tag,
    coalesce(a.name, 'Unnamed asset') as name,
    coalesce(a.serial_number, '-') as serial_number,
    coalesce(a.status, 'available') as state,
    l.name as current_location,
    null::text as holder,
    d.name as department
  from public.assets a
  left join public.locations l on l.id = a.current_location_id
  left join public.departments d on d.id = a.department_id
  where lower(coalesce(a.status, '')) = 'available'
  order by coalesce(a.name, ''), coalesce(a.code, '');
$$;

create or replace function public.list_standard_sign_in_assets()
returns table (
  id uuid,
  tag text,
  name text,
  serial_number text,
  state text,
  current_location text,
  holder text,
  department text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id,
    coalesce(a.code, 'No tag') as tag,
    coalesce(a.name, 'Unnamed asset') as name,
    coalesce(a.serial_number, '-') as serial_number,
    coalesce(a.status, 'unknown') as state,
    l.name as current_location,
    coalesce(nullif(trim(coalesce(p.display_name, '') || ' ' || coalesce(p.surname, '')), ''), p.full_name, 'Assigned user') as holder,
    d.name as department
  from public.assets a
  left join public.locations l on l.id = a.current_location_id
  left join public.departments d on d.id = a.department_id
  left join public.profiles p on p.id = a.current_holder
  where lower(coalesce(a.status, '')) in ('assigned', 'traveling', 'signed_out', 'permanent')
    and a.current_holder is not null
  order by coalesce(a.name, ''), coalesce(a.code, '');
$$;

create or replace function public.list_standard_recipients()
returns table (
  id uuid,
  full_name text,
  email text,
  role text,
  home_base text,
  department text
)
language sql
stable
security definer
set search_path = public
as $$
  with primary_roles as (
    select distinct on (ur.user_id) ur.user_id, ur.role
    from public.user_roles ur
    order by ur.user_id,
      case ur.role
        when 'main_admin' then 1
        when 'admin' then 2
        when 'asset_manager' then 3
        when 'staff' then 4
        else 5
      end
  )
  select
    p.id,
    coalesce(nullif(trim(coalesce(p.display_name, '') || ' ' || coalesce(p.surname, '')), ''), p.full_name, split_part(coalesce(p.email, ''), '@', 1), 'Unknown user') as full_name,
    coalesce(p.email, '') as email,
    coalesce(pr.role, 'staff') as role,
    l.name as home_base,
    null::text as department
  from public.profiles p
  left join primary_roles pr on pr.user_id = p.id
  left join public.locations l on l.id = coalesce(p.assigned_location_id, p.asset_manager_location_id)
  where public.is_approved(p.id)
  order by full_name asc;
$$;

create or replace function public.list_return_request_monitor()
returns table (
  id uuid,
  request_id uuid,
  preferred_return_location text,
  status text,
  note text,
  created_at timestamptz,
  workflow_status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    rr.id,
    rr.request_id,
    l.name as preferred_return_location,
    rr.status,
    rr.note,
    rr.created_at,
    r.status as workflow_status
  from public.return_requests rr
  join public.requests r on r.id = rr.request_id
  left join public.locations l on l.id = rr.preferred_return_location_id
  order by rr.created_at desc;
$$;

create or replace function public.standard_sign_out_assets(
  p_asset_ids uuid[],
  p_holder_id uuid,
  p_note text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expected_count integer;
  v_updated_count integer;
  v_location_id uuid;
  v_location_count integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if coalesce(array_length(p_asset_ids, 1), 0) = 0 then
    raise exception 'Select at least one asset';
  end if;

  if p_holder_id is null then
    raise exception 'Choose a recipient';
  end if;

  v_expected_count := array_length(p_asset_ids, 1);

  select count(distinct a.current_location_id)
  into v_location_count
  from public.assets a
  where a.id = any (p_asset_ids);

  if v_location_count > 1 then
    raise exception 'Selected assets must share one source location';
  end if;

  select a.current_location_id
  into v_location_id
  from public.assets a
  where a.id = any (p_asset_ids)
    and a.current_location_id is not null
  order by a.current_location_id
  limit 1;

  update public.assets
  set
    current_holder = p_holder_id,
    status = 'assigned'
  where id = any (p_asset_ids)
    and lower(coalesce(status, '')) = 'available';

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> v_expected_count then
    raise exception 'One or more selected assets are not available for sign-out';
  end if;

  insert into public.asset_history (asset_id, action, notes, performed_by)
  select
    asset_id,
    'sign_out',
    p_note,
    auth.uid()
  from unnest(p_asset_ids) as asset_id;

  insert into public.approvals (approval_type, status, assigned_to, payload, review_notes)
  values (
    'recipient_signout',
    'Awaiting Recipient',
    p_holder_id,
    jsonb_build_object(
      'asset_ids', p_asset_ids,
      'requested_by', auth.uid(),
      'recipient_id', p_holder_id,
      'source_location_id', v_location_id,
      'notes', p_note
    ),
    null
  );

  return v_updated_count;
end;
$$;

create or replace function public.standard_sign_in_assets(
  p_asset_ids uuid[],
  p_final_location_id uuid,
  p_outcome text,
  p_note text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expected_count integer;
  v_updated_count integer;
  v_normalized_outcome text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if coalesce(array_length(p_asset_ids, 1), 0) = 0 then
    raise exception 'Select at least one asset';
  end if;

  if p_final_location_id is null then
    raise exception 'Choose a final location';
  end if;

  v_normalized_outcome := lower(coalesce(p_outcome, ''));
  if v_normalized_outcome not in ('available', 'damaged') then
    raise exception 'Unsupported sign-in outcome';
  end if;

  v_expected_count := array_length(p_asset_ids, 1);

  update public.assets
  set
    current_holder = null,
    current_location_id = p_final_location_id,
    status = case when v_normalized_outcome = 'damaged' then 'damaged' else 'available' end
  where id = any (p_asset_ids)
    and lower(coalesce(status, '')) in ('assigned', 'traveling', 'signed_out', 'permanent');

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> v_expected_count then
    raise exception 'One or more selected assets are not eligible for sign-in';
  end if;

  insert into public.asset_history (asset_id, action, notes, performed_by)
  select
    asset_id,
    'sign_in',
    p_note,
    auth.uid()
  from unnest(p_asset_ids) as asset_id;

  return v_updated_count;
end;
$$;

create or replace function public.submit_asset_request_bundle(
  target_location_id uuid,
  target_needed_for text default null,
  target_needed_by timestamptz default null,
  target_notes text default null,
  request_items jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bundle_id uuid;
  v_request_id uuid;
  v_asset_ids uuid[];
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if target_location_id is null then
    raise exception 'Choose a source location';
  end if;

  if coalesce(jsonb_array_length(coalesce(request_items, '[]'::jsonb)), 0) = 0 then
    raise exception 'Choose at least one request item';
  end if;

  insert into public.asset_request_bundles (
    requested_by,
    location_id,
    needed_for,
    needed_by,
    notes,
    status
  )
  values (
    auth.uid(),
    target_location_id,
    nullif(trim(coalesce(target_needed_for, '')), ''),
    target_needed_by,
    nullif(trim(coalesce(target_notes, '')), ''),
    'Pending'
  )
  returning id into v_bundle_id;

  insert into public.asset_request_bundle_items (
    bundle_id,
    asset_id,
    item_description,
    source_status,
    status
  )
  select
    v_bundle_id,
    nullif(item.value ->> 'asset_id', '')::uuid,
    nullif(item.value ->> 'item_description', ''),
    null,
    'Pending'
  from jsonb_array_elements(coalesce(request_items, '[]'::jsonb)) as item(value);

  select coalesce(array_agg(asset_id), '{}'::uuid[])
  into v_asset_ids
  from public.asset_request_bundle_items
  where bundle_id = v_bundle_id
    and asset_id is not null;

  insert into public.requests (
    requested_by,
    workflow_type,
    source_location_id,
    status,
    payload
  )
  values (
    auth.uid(),
    'asset_request',
    target_location_id,
    'Pending',
    jsonb_build_object(
      'bundle_id', v_bundle_id,
      'asset_ids', v_asset_ids,
      'needed_for', target_needed_for,
      'needed_by', target_needed_by,
      'notes', target_notes
    )
  )
  returning id into v_request_id;

  insert into public.approvals (
    request_id,
    approval_type,
    status,
    payload
  )
  values (
    v_request_id,
    'asset_request',
    'Pending',
    jsonb_build_object(
      'bundle_id', v_bundle_id,
      'asset_ids', v_asset_ids,
      'location_id', target_location_id,
      'requested_by', auth.uid(),
      'notes', target_notes,
      'package_name', target_needed_for
    )
  );

  return v_bundle_id;
end;
$$;

create or replace function public.list_settings_locations()
returns table (
  id uuid,
  name text,
  active boolean,
  is_home_base boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select l.id, l.name, l.active, l.is_home_base
  from public.locations l
  order by l.name asc;
$$;

create or replace function public.list_settings_departments()
returns table (
  id uuid,
  name text,
  active boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select d.id, d.name, d.active
  from public.departments d
  order by d.name asc;
$$;

create or replace function public.list_settings_consumables()
returns table (
  id uuid,
  name text,
  department text,
  unit text,
  stock_on_hand integer,
  reorder_level integer,
  active boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.name, c.department, c.unit, c.stock_on_hand, c.reorder_level, c.active
  from public.consumables c
  order by c.name asc;
$$;

create or replace function public.list_settings_duplicates()
returns table (
  id uuid,
  primary_asset text,
  duplicate_asset text,
  status text,
  notes text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select d.id, d.primary_asset, d.duplicate_asset, d.status, d.notes, d.created_at
  from public.duplicates d
  order by d.created_at desc;
$$;

create or replace function public.list_settings_config()
returns table (
  key text,
  value jsonb,
  description text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select ac.key, ac.value, ac.description, ac.updated_at
  from public.app_config ac
  order by ac.key asc;
$$;

create or replace function public.list_settings_users()
returns table (
  id uuid,
  full_name text,
  email text,
  role text,
  home_base text,
  department text,
  approved boolean,
  locked boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with primary_roles as (
    select distinct on (ur.user_id) ur.user_id, ur.role
    from public.user_roles ur
    order by ur.user_id,
      case ur.role
        when 'main_admin' then 1
        when 'admin' then 2
        when 'asset_manager' then 3
        when 'staff' then 4
        else 5
      end
  ),
  active_damage_locks as (
    select distinct dc.responsible_user_id
    from public.damage_cases dc
    where lower(coalesce(dc.status, '')) in ('locked', 'form pending')
  )
  select
    p.id,
    coalesce(nullif(trim(coalesce(p.display_name, '') || ' ' || coalesce(p.surname, '')), ''), p.full_name, split_part(coalesce(p.email, ''), '@', 1), 'Unknown user') as full_name,
    coalesce(p.email, '') as email,
    coalesce(pr.role, 'staff') as role,
    l.name as home_base,
    null::text as department,
    public.is_approved(p.id) as approved,
    adl.responsible_user_id is not null as locked
  from public.profiles p
  left join primary_roles pr on pr.user_id = p.id
  left join public.locations l on l.id = coalesce(p.assigned_location_id, p.asset_manager_location_id)
  left join active_damage_locks adl on adl.responsible_user_id = p.id
  order by full_name asc;
$$;

create or replace function public.resolve_settings_duplicate(
  p_duplicate_id uuid,
  p_status text,
  p_survivor_asset text default null,
  p_note text default null
)
returns public.duplicates
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.duplicates;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.duplicates
  set
    status = coalesce(nullif(trim(p_status), ''), status),
    primary_asset = coalesce(nullif(trim(p_survivor_asset), ''), primary_asset),
    notes = coalesce(nullif(trim(p_note), ''), notes)
  where id = p_duplicate_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Duplicate record not found';
  end if;

  return v_row;
end;
$$;

create or replace function public.review_approval(
  p_approval_id uuid,
  p_status text,
  p_review_notes text default null
)
returns public.approvals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.approvals;
  v_request_status text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.approvals
  set
    status = p_status,
    review_notes = p_review_notes
  where id = p_approval_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Approval not found';
  end if;

  v_request_status := case
    when lower(coalesce(p_status, '')) = 'approved' then 'Approved'
    when lower(coalesce(p_status, '')) = 'declined' then 'Declined'
    when lower(coalesce(p_status, '')) = 'request changes' then 'Request Changes'
    else p_status
  end;

  if v_row.request_id is not null then
    update public.requests
    set status = v_request_status
    where id = v_row.request_id;

    update public.return_requests
    set status = v_request_status
    where request_id = v_row.request_id;
  end if;

  return v_row;
end;
$$;

create or replace function public.get_my_pending_recipient_signout_approvals()
returns table (
  id uuid,
  flow_type text,
  package_name text,
  notes text,
  source_location_name text,
  requested_by_name text,
  created_at timestamptz,
  items jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with my_rows as (
    select a.*
    from public.approvals a
    where a.assigned_to = auth.uid()
      and lower(coalesce(a.approval_type, '')) = 'recipient_signout'
      and lower(coalesce(a.status, '')) = 'awaiting recipient'
  ),
  expanded as (
    select
      mr.id,
      mr.approval_type,
      mr.payload,
      mr.created_at,
      nullif(value, '')::uuid as asset_id
    from my_rows mr
    left join lateral jsonb_array_elements_text(coalesce(mr.payload -> 'asset_ids', '[]'::jsonb)) as value on true
  )
  select
    mr.id,
    coalesce(mr.approval_type, 'recipient_signout') as flow_type,
    mr.payload ->> 'package_name' as package_name,
    mr.payload ->> 'notes' as notes,
    l.name as source_location_name,
    coalesce(nullif(trim(coalesce(p.display_name, '') || ' ' || coalesce(p.surname, '')), ''), p.full_name, split_part(coalesce(p.email, ''), '@', 1), 'Unknown user') as requested_by_name,
    mr.created_at,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'asset_id', a.id,
          'code', a.code,
          'name', a.name,
          'serial_number', a.serial_number,
          'location_name', l2.name,
          'division_name', d.name
        )
        order by a.name, a.code
      ) filter (where a.id is not null),
      '[]'::jsonb
    ) as items
  from my_rows mr
  left join public.locations l on l.id = nullif(mr.payload ->> 'source_location_id', '')::uuid
  left join public.profiles p on p.id = nullif(mr.payload ->> 'requested_by', '')::uuid
  left join expanded e on e.id = mr.id
  left join public.assets a on a.id = e.asset_id
  left join public.locations l2 on l2.id = a.current_location_id
  left join public.departments d on d.id = a.department_id
  group by mr.id, mr.approval_type, mr.payload, mr.created_at, l.name, p.display_name, p.surname, p.full_name, p.email
  order by mr.created_at desc;
$$;

create or replace function public.approve_recipient_signout_approval(
  target_approval_id uuid
)
returns public.approvals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.approvals;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.approvals
  set status = 'Approved'
  where id = target_approval_id
    and assigned_to = auth.uid()
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Recipient approval not found';
  end if;

  return v_row;
end;
$$;

create or replace function public.decline_recipient_signout_approval(
  target_approval_id uuid,
  decline_notes text default null
)
returns public.approvals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.approvals;
  v_asset_ids uuid[];
  v_source_location_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_row
  from public.approvals
  where id = target_approval_id
    and assigned_to = auth.uid();

  if v_row.id is null then
    raise exception 'Recipient approval not found';
  end if;

  select coalesce(array_agg(value::uuid), '{}'::uuid[])
  into v_asset_ids
  from jsonb_array_elements_text(coalesce(v_row.payload -> 'asset_ids', '[]'::jsonb)) as value;

  v_source_location_id := nullif(v_row.payload ->> 'source_location_id', '')::uuid;

  if coalesce(array_length(v_asset_ids, 1), 0) > 0 then
    update public.assets
    set
      current_holder = null,
      current_location_id = coalesce(v_source_location_id, current_location_id),
      status = 'available'
    where id = any (v_asset_ids);
  end if;

  update public.approvals
  set
    status = 'Declined',
    review_notes = decline_notes
  where id = target_approval_id
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.respond_handover(
  target_handover_id uuid,
  accept_handover boolean
)
returns public.handovers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.handovers;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_row
  from public.handovers
  where id = target_handover_id
    and to_user = auth.uid();

  if v_row.id is null then
    raise exception 'Handover not found';
  end if;

  if accept_handover then
    update public.assets
    set current_holder = v_row.to_user
    where id in (
      select hi.asset_id
      from public.handover_items hi
      where hi.handover_id = v_row.id
    );
  end if;

  update public.handovers
  set status = case when accept_handover then 'accepted' else 'declined' end
  where id = target_handover_id
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.resolve_damage_case(
  p_case_id uuid,
  p_resolved_state text,
  p_condition_note text default null
)
returns public.damage_cases
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.damage_cases;
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_row
  from public.damage_cases
  where id = p_case_id;

  if v_row.id is null then
    raise exception 'Damage case not found';
  end if;

  v_status := case
    when lower(coalesce(p_resolved_state, '')) = 'available' then 'Resolved: Available'
    else 'Resolved: Damaged'
  end;

  if v_row.asset_id is not null then
    update public.assets
    set
      current_holder = null,
      status = case when lower(coalesce(p_resolved_state, '')) = 'available' then 'available' else 'damaged' end
    where id = v_row.asset_id;
  end if;

  update public.damage_cases
  set
    status = v_status,
    condition_note = p_condition_note
  where id = p_case_id
  returning * into v_row;

  return v_row;
end;
$$;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.locations enable row level security;
alter table public.departments enable row level security;
alter table public.assets enable row level security;
alter table public.asset_history enable row level security;
alter table public.requests enable row level security;
alter table public.approvals enable row level security;
alter table public.return_requests enable row level security;
alter table public.asset_request_bundles enable row level security;
alter table public.asset_request_bundle_items enable row level security;
alter table public.handovers enable row level security;
alter table public.handover_items enable row level security;
alter table public.damage_cases enable row level security;
alter table public.damage_reports enable row level security;
alter table public.kits enable row level security;
alter table public.consumables enable row level security;
alter table public.app_config enable row level security;
alter table public.duplicates enable row level security;

drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated on public.profiles
for select to authenticated
using (true);

drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin on public.profiles
for update to authenticated
using (
  (select auth.uid()) = id
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role in ('main_admin', 'admin')
  )
)
with check (
  (select auth.uid()) = id
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role in ('main_admin', 'admin')
  )
);

drop policy if exists user_roles_select_authenticated on public.user_roles;
create policy user_roles_select_authenticated on public.user_roles
for select to authenticated
using (true);

drop policy if exists locations_select_authenticated on public.locations;
create policy locations_select_authenticated on public.locations
for select to authenticated
using (true);

drop policy if exists departments_select_authenticated on public.departments;
create policy departments_select_authenticated on public.departments
for select to authenticated
using (true);

drop policy if exists assets_select_authenticated on public.assets;
create policy assets_select_authenticated on public.assets
for select to authenticated
using (true);

drop policy if exists assets_update_ops on public.assets;
create policy assets_update_ops on public.assets
for update to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role in ('main_admin', 'admin', 'asset_manager')
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role in ('main_admin', 'admin', 'asset_manager')
  )
);

drop policy if exists asset_history_select_authenticated on public.asset_history;
create policy asset_history_select_authenticated on public.asset_history
for select to authenticated
using (true);

drop policy if exists requests_select_authenticated on public.requests;
create policy requests_select_authenticated on public.requests
for select to authenticated
using (true);

drop policy if exists approvals_select_authenticated on public.approvals;
create policy approvals_select_authenticated on public.approvals
for select to authenticated
using (true);

drop policy if exists approvals_update_ops on public.approvals;
create policy approvals_update_ops on public.approvals
for update to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role in ('main_admin', 'admin', 'asset_manager')
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role in ('main_admin', 'admin', 'asset_manager')
  )
);

drop policy if exists return_requests_select_authenticated on public.return_requests;
create policy return_requests_select_authenticated on public.return_requests
for select to authenticated
using (true);

drop policy if exists asset_request_bundles_select_authenticated on public.asset_request_bundles;
create policy asset_request_bundles_select_authenticated on public.asset_request_bundles
for select to authenticated
using (true);

drop policy if exists asset_request_bundle_items_select_authenticated on public.asset_request_bundle_items;
create policy asset_request_bundle_items_select_authenticated on public.asset_request_bundle_items
for select to authenticated
using (true);

drop policy if exists handovers_select_authenticated on public.handovers;
create policy handovers_select_authenticated on public.handovers
for select to authenticated
using (true);

drop policy if exists handovers_insert_authenticated on public.handovers;
create policy handovers_insert_authenticated on public.handovers
for insert to authenticated
with check ((select auth.uid()) = from_user);

drop policy if exists handovers_update_party_or_admin on public.handovers;
create policy handovers_update_party_or_admin on public.handovers
for update to authenticated
using (
  (select auth.uid()) in (from_user, to_user)
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role in ('main_admin', 'admin', 'asset_manager')
  )
)
with check (
  (select auth.uid()) in (from_user, to_user)
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role in ('main_admin', 'admin', 'asset_manager')
  )
);

drop policy if exists handover_items_select_authenticated on public.handover_items;
create policy handover_items_select_authenticated on public.handover_items
for select to authenticated
using (true);

drop policy if exists handover_items_insert_authenticated on public.handover_items;
create policy handover_items_insert_authenticated on public.handover_items
for insert to authenticated
with check (true);

drop policy if exists damage_cases_select_authenticated on public.damage_cases;
create policy damage_cases_select_authenticated on public.damage_cases
for select to authenticated
using (true);

drop policy if exists damage_cases_insert_authenticated on public.damage_cases;
create policy damage_cases_insert_authenticated on public.damage_cases
for insert to authenticated
with check ((select auth.uid()) = responsible_user_id);

drop policy if exists damage_cases_update_self_or_ops on public.damage_cases;
create policy damage_cases_update_self_or_ops on public.damage_cases
for update to authenticated
using (
  (select auth.uid()) = responsible_user_id
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role in ('main_admin', 'admin', 'asset_manager')
  )
)
with check (
  (select auth.uid()) = responsible_user_id
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role in ('main_admin', 'admin', 'asset_manager')
  )
);

drop policy if exists damage_reports_select_authenticated on public.damage_reports;
create policy damage_reports_select_authenticated on public.damage_reports
for select to authenticated
using (true);

drop policy if exists damage_reports_insert_authenticated on public.damage_reports;
create policy damage_reports_insert_authenticated on public.damage_reports
for insert to authenticated
with check ((select auth.uid()) = assigned_to);

drop policy if exists damage_reports_update_authenticated on public.damage_reports;
create policy damage_reports_update_authenticated on public.damage_reports
for update to authenticated
using (
  (select auth.uid()) = assigned_to
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role in ('main_admin', 'admin', 'asset_manager')
  )
)
with check (
  (select auth.uid()) = assigned_to
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role in ('main_admin', 'admin', 'asset_manager')
  )
);

drop policy if exists kits_select_authenticated on public.kits;
create policy kits_select_authenticated on public.kits
for select to authenticated
using (true);

drop policy if exists consumables_select_authenticated on public.consumables;
create policy consumables_select_authenticated on public.consumables
for select to authenticated
using (true);

drop policy if exists app_config_select_authenticated on public.app_config;
create policy app_config_select_authenticated on public.app_config
for select to authenticated
using (true);

drop policy if exists duplicates_select_authenticated on public.duplicates;
create policy duplicates_select_authenticated on public.duplicates
for select to authenticated
using (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant usage, select on sequences to authenticated;
alter default privileges in schema public grant execute on functions to authenticated;
