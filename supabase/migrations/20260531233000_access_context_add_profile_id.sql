drop function if exists public.get_my_access_context();

create or replace function public.get_my_access_context()
returns table (
  id uuid,
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
    p.id,
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
