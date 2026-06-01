create or replace function public.list_my_assigned_assets()
returns table (
  id uuid,
  tag text,
  name text,
  serial_number text,
  state public.asset_state,
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
    a.tag,
    a.name,
    a.serial_number,
    a.state,
    l.name as current_location,
    p.full_name as holder,
    d.name as department
  from public.assets a
  left join public.locations l on l.id = a.current_location_id
  left join public.profiles p on p.id = a.current_holder_id
  left join public.departments d on d.id = a.department_id
  where a.current_holder_id = auth.uid()
    and a.state = 'Assigned'
  order by a.name, a.tag;
$$;
