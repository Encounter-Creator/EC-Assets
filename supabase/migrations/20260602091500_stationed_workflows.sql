create or replace function public.stationed_checkout_assets(
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
  v_eligible_count integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if coalesce(array_length(p_asset_ids, 1), 0) = 0 then
    raise exception 'Select at least one asset';
  end if;

  if p_holder_id is null then
    raise exception 'Choose a responsible user';
  end if;

  v_expected_count := array_length(p_asset_ids, 1);

  select count(*)
  into v_eligible_count
  from public.assets a
  where a.id = any (p_asset_ids)
    and lower(coalesce(a.status, '')) = 'stationed';

  if coalesce(v_eligible_count, 0) <> v_expected_count then
    raise exception 'One or more selected assets are not currently stationed';
  end if;

  update public.assets
  set
    current_holder = p_holder_id,
    status = 'traveling'
  where id = any (p_asset_ids);

  get diagnostics v_eligible_count = row_count;

  if v_eligible_count <> v_expected_count then
    raise exception 'Stationed checkout updated %, expected %', v_eligible_count, v_expected_count;
  end if;

  return v_eligible_count;
end;
$$;

create or replace function public.stationed_checkin_assets(
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
  v_eligible_count integer;
  v_normalized_outcome text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if coalesce(array_length(p_asset_ids, 1), 0) = 0 then
    raise exception 'Select at least one asset';
  end if;

  if p_final_location_id is null then
    raise exception 'Choose a return location';
  end if;

  v_normalized_outcome := lower(coalesce(p_outcome, ''));
  if v_normalized_outcome not in ('stationed', 'damaged') then
    raise exception 'Unsupported stationed check-in outcome';
  end if;

  v_expected_count := array_length(p_asset_ids, 1);

  select count(*)
  into v_eligible_count
  from public.assets a
  where a.id = any (p_asset_ids)
    and lower(coalesce(a.status, '')) = 'traveling';

  if coalesce(v_eligible_count, 0) <> v_expected_count then
    raise exception 'One or more selected assets are not currently out on a stationed temporary use';
  end if;

  update public.assets
  set
    current_holder = null,
    current_location_id = p_final_location_id,
    status = case when v_normalized_outcome = 'damaged' then 'damaged' else 'stationed' end
  where id = any (p_asset_ids);

  get diagnostics v_eligible_count = row_count;

  if v_eligible_count <> v_expected_count then
    raise exception 'Stationed check-in updated %, expected %', v_eligible_count, v_expected_count;
  end if;

  return v_eligible_count;
end;
$$;
