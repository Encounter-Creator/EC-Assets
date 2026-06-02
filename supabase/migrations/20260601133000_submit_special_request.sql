create or replace function public.submit_special_request(
  p_source_location_id uuid,
  p_asset_id uuid,
  p_request_type text,
  p_needed_by timestamptz default null,
  p_duration text default null,
  p_reason text default null,
  p_event_context text default null
)
returns public.requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.requests;
  v_asset record;
  v_workflow_type text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_asset_id is null then
    raise exception 'Choose a target asset';
  end if;

  v_workflow_type := lower(coalesce(p_request_type, ''));
  if v_workflow_type not in ('stationed_use', 'permanent_reassignment') then
    raise exception 'Unsupported special request type';
  end if;

  select a.id, a.code, a.name, a.status, a.current_location_id
  into v_asset
  from public.assets a
  where a.id = p_asset_id;

  if v_asset.id is null then
    raise exception 'Selected asset was not found';
  end if;

  if lower(coalesce(v_asset.status, '')) not in ('available', 'stationed', 'permanent') then
    raise exception 'Selected asset is not eligible for this special request flow';
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
    v_workflow_type,
    coalesce(p_source_location_id, v_asset.current_location_id),
    'Pending',
    jsonb_build_object(
      'asset_id', v_asset.id,
      'asset_tag', v_asset.code,
      'asset_name', v_asset.name,
      'needed_by', p_needed_by,
      'duration', p_duration,
      'reason', p_reason,
      'event_context', p_event_context
    )
  )
  returning * into v_request;

  insert into public.approvals (
    request_id,
    approval_type,
    status,
    assigned_to,
    payload
  )
  values (
    v_request.id,
    v_workflow_type,
    'Pending',
    null,
    jsonb_build_object(
      'asset_id', v_asset.id,
      'asset_tag', v_asset.code,
      'asset_name', v_asset.name,
      'location_id', coalesce(p_source_location_id, v_asset.current_location_id),
      'needed_by', p_needed_by,
      'duration', p_duration,
      'reason', p_reason,
      'event_context', p_event_context,
      'requested_by', auth.uid()
    )
  );

  return v_request;
end;
$$;
