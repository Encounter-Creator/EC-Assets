create or replace function public.submit_return_request(
  p_source_location_id uuid,
  p_asset_ids uuid[],
  p_return_date timestamptz,
  p_preferred_return_location_id uuid,
  p_note text default null
)
returns public.requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.requests;
  v_asset_count integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if coalesce(array_length(p_asset_ids, 1), 0) = 0 then
    raise exception 'Select at least one asset';
  end if;

  if p_preferred_return_location_id is null then
    raise exception 'Preferred return location is required';
  end if;

  select count(*)
  into v_asset_count
  from public.assets a
  where a.id = any (p_asset_ids)
    and a.current_holder = auth.uid()
    and lower(coalesce(a.status, '')) = 'assigned';

  if coalesce(v_asset_count, 0) <> array_length(p_asset_ids, 1) then
    raise exception 'One or more selected assets are not eligible for return request submission';
  end if;

  insert into public.requests (
    requested_by,
    workflow_type,
    source_location_id,
    status,
    payload
  )
  values (
    auth.uid(),
    'return',
    p_source_location_id,
    'Pending',
    jsonb_build_object(
      'asset_ids', p_asset_ids,
      'asset_count', v_asset_count,
      'return_date', p_return_date,
      'note', p_note
    )
  )
  returning * into v_request;

  insert into public.return_requests (
    request_id,
    preferred_return_location_id,
    status,
    note
  )
  values (
    v_request.id,
    p_preferred_return_location_id,
    'Pending',
    p_note
  );

  insert into public.approvals (
    request_id,
    approval_type,
    status,
    assigned_to,
    payload
  )
  values (
    v_request.id,
    'return',
    'Pending',
    null,
    jsonb_build_object(
      'asset_ids', p_asset_ids,
      'asset_count', v_asset_count,
      'return_date', p_return_date,
      'note', p_note
    )
  );

  return v_request;
end;
$$;
