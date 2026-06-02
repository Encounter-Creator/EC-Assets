create or replace function public.permanent_assign_assets(
  p_asset_ids uuid[],
  p_holder_id uuid,
  p_home_base_location_id uuid,
  p_mode text,
  p_note text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mode text;
  v_expected_count integer;
  v_updated_count integer;
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

  if p_home_base_location_id is null then
    raise exception 'Choose a home-base location';
  end if;

  v_mode := lower(coalesce(p_mode, ''));
  if v_mode not in ('direct_issue', 'reassign') then
    raise exception 'Unsupported permanent-assignment mode';
  end if;

  v_expected_count := array_length(p_asset_ids, 1);

  if v_mode = 'direct_issue' then
    select count(*)
    into v_updated_count
    from public.assets a
    where a.id = any (p_asset_ids)
      and lower(coalesce(a.status, '')) in ('available', 'stationed');

    if coalesce(v_updated_count, 0) <> v_expected_count then
      raise exception 'One or more selected assets are not eligible for direct permanent issue';
    end if;
  else
    select count(*)
    into v_updated_count
    from public.assets a
    where a.id = any (p_asset_ids)
      and a.current_holder is not null
      and lower(coalesce(a.status, '')) in ('assigned', 'permanent');

    if coalesce(v_updated_count, 0) <> v_expected_count then
      raise exception 'One or more selected assets are not eligible for permanent reassignment';
    end if;
  end if;

  update public.assets
  set
    current_holder = p_holder_id,
    current_location_id = p_home_base_location_id,
    status = 'assigned'
  where id = any (p_asset_ids);

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> v_expected_count then
    raise exception 'Permanent assignment updated %, expected %', v_updated_count, v_expected_count;
  end if;

  return v_updated_count;
end;
$$;
