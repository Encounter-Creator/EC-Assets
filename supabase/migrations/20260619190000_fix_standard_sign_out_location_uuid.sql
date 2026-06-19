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

  select
    count(distinct a.current_location_id)
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
    p_note
  );

  return v_updated_count;
end;
$$;
