create or replace function public.create_settings_location(
  p_name text,
  p_is_home_base boolean default true
)
returns public.locations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.locations;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'Location name is required';
  end if;

  insert into public.locations (
    name,
    active,
    is_home_base
  )
  values (
    trim(p_name),
    true,
    coalesce(p_is_home_base, true)
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.set_settings_location_active(
  p_location_id uuid,
  p_active boolean
)
returns public.locations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.locations;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.locations
  set active = p_active
  where id = p_location_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Location not found';
  end if;

  return v_row;
end;
$$;

create or replace function public.create_settings_department(
  p_name text
)
returns public.departments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.departments;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'Department name is required';
  end if;

  insert into public.departments (
    name,
    active
  )
  values (
    trim(p_name),
    true
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.set_settings_department_active(
  p_department_id uuid,
  p_active boolean
)
returns public.departments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.departments;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.departments
  set active = p_active
  where id = p_department_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Department not found';
  end if;

  return v_row;
end;
$$;
