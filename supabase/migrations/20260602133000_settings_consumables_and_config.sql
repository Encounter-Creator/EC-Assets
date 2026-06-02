create or replace function public.create_settings_consumable(
  p_name text,
  p_department text default null,
  p_unit text,
  p_stock_on_hand integer default 0,
  p_reorder_level integer default 0
)
returns public.consumables
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.consumables;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'Consumable name is required';
  end if;

  if coalesce(trim(p_unit), '') = '' then
    raise exception 'Unit is required';
  end if;

  insert into public.consumables (
    name,
    department,
    unit,
    stock_on_hand,
    reorder_level,
    active
  )
  values (
    trim(p_name),
    nullif(trim(p_department), ''),
    trim(p_unit),
    greatest(coalesce(p_stock_on_hand, 0), 0),
    greatest(coalesce(p_reorder_level, 0), 0),
    true
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.set_settings_consumable_active(
  p_consumable_id uuid,
  p_active boolean
)
returns public.consumables
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.consumables;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.consumables
  set active = p_active
  where id = p_consumable_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Consumable not found';
  end if;

  return v_row;
end;
$$;

create or replace function public.save_settings_config(
  p_key text,
  p_value jsonb,
  p_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if coalesce(trim(p_key), '') = '' then
    raise exception 'Config key is required';
  end if;

  insert into public.app_config (
    key,
    value,
    description,
    updated_at
  )
  values (
    trim(p_key),
    coalesce(p_value, '{}'::jsonb),
    p_description,
    now()
  )
  on conflict (key) do update
  set
    value = excluded.value,
    description = excluded.description,
    updated_at = now();

  return coalesce(p_value, '{}'::jsonb);
end;
$$;
