create or replace function public.list_inventory_assets()
returns table (
  id uuid,
  tag text,
  name text,
  serial_number text,
  item_type text,
  state public.asset_state,
  current_location text,
  holder text,
  department text,
  condition_note text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id,
    a.tag,
    a.name,
    a.serial_number,
    a.item_type,
    a.state,
    l.name as current_location,
    p.full_name as holder,
    d.name as department,
    a.condition_note
  from public.assets a
  left join public.locations l on l.id = a.current_location_id
  left join public.profiles p on p.id = a.current_holder_id
  left join public.departments d on d.id = a.department_id
  order by a.name, a.tag;
$$;

create or replace function public.get_asset_detail(p_asset_id uuid)
returns table (
  id uuid,
  tag text,
  name text,
  serial_number text,
  item_type text,
  state public.asset_state,
  current_location text,
  holder text,
  department text,
  condition_note text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id,
    a.tag,
    a.name,
    a.serial_number,
    a.item_type,
    a.state,
    l.name as current_location,
    p.full_name as holder,
    d.name as department,
    a.condition_note
  from public.assets a
  left join public.locations l on l.id = a.current_location_id
  left join public.profiles p on p.id = a.current_holder_id
  left join public.departments d on d.id = a.department_id
  where a.id = p_asset_id;
$$;

create or replace function public.list_asset_history(p_asset_id uuid)
returns table (
  id uuid,
  asset_id uuid,
  action text,
  notes text,
  performed_by text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    h.id,
    h.asset_id,
    h.action,
    h.notes,
    p.full_name as performed_by,
    h.created_at
  from public.asset_history h
  left join public.profiles p on p.id = h.performed_by
  where h.asset_id = p_asset_id
  order by h.created_at desc;
$$;
