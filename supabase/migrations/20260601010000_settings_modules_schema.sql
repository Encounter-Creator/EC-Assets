create table if not exists public.kit_definitions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  home_base_id uuid references public.locations(id),
  active boolean not null default true,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kit_definition_items (
  id uuid primary key default gen_random_uuid(),
  kit_id uuid not null references public.kit_definitions(id) on delete cascade,
  asset_id uuid not null references public.assets(id),
  required boolean not null default true,
  created_at timestamptz not null default now(),
  unique (kit_id, asset_id)
);

create table if not exists public.consumables (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  department_id uuid references public.departments(id),
  unit text not null default 'unit',
  stock_on_hand integer not null default 0,
  reorder_level integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.duplicate_cases (
  id uuid primary key default gen_random_uuid(),
  primary_asset_id uuid references public.assets(id),
  duplicate_asset_id uuid references public.assets(id),
  status text not null default 'Open',
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (primary_asset_id is distinct from duplicate_asset_id)
);

create table if not exists public.app_config (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  description text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

drop trigger if exists kit_definitions_set_updated_at on public.kit_definitions;
create trigger kit_definitions_set_updated_at
before update on public.kit_definitions
for each row
execute function public.set_updated_at();

drop trigger if exists consumables_set_updated_at on public.consumables;
create trigger consumables_set_updated_at
before update on public.consumables
for each row
execute function public.set_updated_at();

drop trigger if exists duplicate_cases_set_updated_at on public.duplicate_cases;
create trigger duplicate_cases_set_updated_at
before update on public.duplicate_cases
for each row
execute function public.set_updated_at();

alter table public.kit_definitions enable row level security;
alter table public.kit_definition_items enable row level security;
alter table public.consumables enable row level security;
alter table public.duplicate_cases enable row level security;
alter table public.app_config enable row level security;

drop policy if exists kits_manager_read on public.kit_definitions;
create policy kits_manager_read
on public.kit_definitions
for select
using (public.is_manager_or_admin());

drop policy if exists kit_items_manager_read on public.kit_definition_items;
create policy kit_items_manager_read
on public.kit_definition_items
for select
using (public.is_manager_or_admin());

drop policy if exists consumables_manager_read on public.consumables;
create policy consumables_manager_read
on public.consumables
for select
using (public.is_manager_or_admin());

drop policy if exists duplicates_admin_read on public.duplicate_cases;
create policy duplicates_admin_read
on public.duplicate_cases
for select
using (public.current_user_role() = 'admin');

drop policy if exists config_admin_read on public.app_config;
create policy config_admin_read
on public.app_config
for select
using (public.current_user_role() = 'admin');

insert into public.app_config (key, value, description)
values
  ('qr_export', '{"labelMm":20,"pageBorderMm":5,"sortBy":"tag","format":"A4"}'::jsonb, 'Bulk QR export defaults'),
  ('notifications', '{"criticalPush":true,"quietHours":false}'::jsonb, 'Notification system toggles')
on conflict (key) do nothing;

create or replace function public.list_settings_users()
returns table (
  id uuid,
  full_name text,
  email text,
  role public.app_role,
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
  select
    p.id,
    p.full_name,
    p.email,
    p.role,
    l.name as home_base,
    d.name as department,
    p.approved,
    p.locked
  from public.profiles p
  left join public.locations l on l.id = p.home_base_id
  left join public.departments d on d.id = p.department_id
  where public.current_user_role() = 'admin'
     or (public.current_user_role() = 'asset_manager' and p.home_base_id = public.current_user_home_base_id())
  order by p.full_name;
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
  select id, name, active, is_home_base
  from public.locations
  where public.is_manager_or_admin()
  order by name;
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
  select id, name, active
  from public.departments
  where public.is_manager_or_admin()
  order by name;
$$;

create or replace function public.list_settings_kits()
returns table (
  id uuid,
  name text,
  home_base text,
  active boolean,
  item_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    k.id,
    k.name,
    l.name as home_base,
    k.active,
    count(i.id) as item_count
  from public.kit_definitions k
  left join public.locations l on l.id = k.home_base_id
  left join public.kit_definition_items i on i.kit_id = k.id
  where public.is_manager_or_admin()
  group by k.id, k.name, l.name, k.active
  order by k.name;
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
  select
    c.id,
    c.name,
    d.name as department,
    c.unit,
    c.stock_on_hand,
    c.reorder_level,
    c.active
  from public.consumables c
  left join public.departments d on d.id = c.department_id
  where public.is_manager_or_admin()
  order by c.name;
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
  select
    d.id,
    coalesce(a1.tag, 'Unknown') as primary_asset,
    coalesce(a2.tag, 'Unknown') as duplicate_asset,
    d.status,
    d.notes,
    d.created_at
  from public.duplicate_cases d
  left join public.assets a1 on a1.id = d.primary_asset_id
  left join public.assets a2 on a2.id = d.duplicate_asset_id
  where public.current_user_role() = 'admin'
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
  select key, value, description, updated_at
  from public.app_config
  where public.current_user_role() = 'admin'
  order by key;
$$;
