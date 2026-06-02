create or replace function public.create_settings_kit(
  p_name text,
  p_home_base text default null,
  p_item_count integer default 0
)
returns public.kits
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.kits;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'Kit name is required';
  end if;

  insert into public.kits (
    name,
    home_base,
    item_count,
    active
  )
  values (
    trim(p_name),
    nullif(trim(p_home_base), ''),
    greatest(coalesce(p_item_count, 0), 0),
    true
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.set_settings_kit_active(
  p_kit_id uuid,
  p_active boolean
)
returns public.kits
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.kits;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.kits
  set active = p_active
  where id = p_kit_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Kit not found';
  end if;

  return v_row;
end;
$$;
