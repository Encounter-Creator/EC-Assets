create table if not exists public.kit_deployment_items (
  id uuid primary key default gen_random_uuid(),
  deployment_id uuid not null references public.kit_deployments(id) on delete cascade,
  asset_id uuid null,
  asset_code text null,
  asset_name text not null,
  serial_number text null,
  sort_order integer not null default 0,
  return_status text not null default 'Pending' check (return_status in ('Pending', 'Available', 'Damaged')),
  returned_at timestamptz null,
  created_at timestamptz not null default now()
);

insert into public.kit_deployment_items (
  deployment_id,
  asset_id,
  asset_code,
  asset_name,
  serial_number,
  sort_order,
  return_status,
  returned_at
)
select
  kd.id,
  null,
  kd.kit_reference || '-' || gs.item_no::text,
  kd.kit_name || ' Item ' || gs.item_no::text,
  null,
  gs.item_no,
  case
    when gs.item_no <= coalesce(kd.returned_count, 0) then 'Available'
    when gs.item_no <= coalesce(kd.returned_count, 0) + coalesce(kd.damaged_count, 0) then 'Damaged'
    else 'Pending'
  end,
  case
    when gs.item_no <= coalesce(kd.returned_count, 0) + coalesce(kd.damaged_count, 0) then now()
    else null
  end
from public.kit_deployments kd
cross join lateral generate_series(1, greatest(coalesce(kd.item_count, 0), 0)) as gs(item_no)
where not exists (
  select 1
  from public.kit_deployment_items kdi
  where kdi.deployment_id = kd.id
);

create or replace function public.deploy_sunday_kit(
  p_kit_reference text,
  p_kit_name text,
  p_item_count integer,
  p_responsible_user_id uuid,
  p_location_id uuid,
  p_note text default null
)
returns public.kit_deployments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.kit_deployments;
  v_item_no integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if coalesce(trim(p_kit_reference), '') = '' or coalesce(trim(p_kit_name), '') = '' then
    raise exception 'Choose a kit';
  end if;

  if coalesce(p_item_count, 0) <= 0 then
    raise exception 'Kit item count must be greater than zero';
  end if;

  if p_responsible_user_id is null then
    raise exception 'Choose a responsible user';
  end if;

  if p_location_id is null then
    raise exception 'Choose a deployment location';
  end if;

  insert into public.kit_deployments (
    kit_reference,
    kit_name,
    item_count,
    responsible_user_id,
    deployed_location_id,
    note
  )
  values (
    p_kit_reference,
    p_kit_name,
    p_item_count,
    p_responsible_user_id,
    p_location_id,
    p_note
  )
  returning * into v_row;

  for v_item_no in 1..p_item_count loop
    insert into public.kit_deployment_items (
      deployment_id,
      asset_id,
      asset_code,
      asset_name,
      serial_number,
      sort_order,
      return_status
    )
    values (
      v_row.id,
      null,
      p_kit_reference || '-' || v_item_no::text,
      p_kit_name || ' Item ' || v_item_no::text,
      null,
      v_item_no,
      'Pending'
    );
  end loop;

  return v_row;
end;
$$;

create or replace function public.return_sunday_kit_item_resolutions(
  p_deployment_id uuid,
  p_item_resolutions jsonb,
  p_note text default null
)
returns public.kit_deployments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.kit_deployments;
  v_resolution jsonb;
  v_item_id uuid;
  v_outcome text;
  v_updated_count integer := 0;
  v_returned_count integer := 0;
  v_damaged_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_deployment_id is null then
    raise exception 'Choose a deployment';
  end if;

  if coalesce(jsonb_array_length(coalesce(p_item_resolutions, '[]'::jsonb)), 0) = 0 then
    raise exception 'Choose at least one kit item to resolve';
  end if;

  select *
  into v_row
  from public.kit_deployments
  where id = p_deployment_id;

  if v_row.id is null then
    raise exception 'Deployment not found';
  end if;

  for v_resolution in
    select value
    from jsonb_array_elements(coalesce(p_item_resolutions, '[]'::jsonb))
  loop
    v_item_id := nullif(v_resolution ->> 'item_id', '')::uuid;
    v_outcome := lower(coalesce(v_resolution ->> 'outcome', ''));

    if v_item_id is null then
      raise exception 'Item resolution is missing an item id';
    end if;

    if v_outcome not in ('available', 'damaged') then
      raise exception 'Unsupported Sunday kit return outcome';
    end if;

    update public.kit_deployment_items
    set
      return_status = case when v_outcome = 'damaged' then 'Damaged' else 'Available' end,
      returned_at = now()
    where id = v_item_id
      and deployment_id = p_deployment_id
      and return_status = 'Pending';

    get diagnostics v_updated_count = row_count;

    if v_updated_count <> 1 then
      raise exception 'One or more selected Sunday kit items are invalid or already resolved';
    end if;
  end loop;

  select
    count(*) filter (where return_status = 'Available'),
    count(*) filter (where return_status = 'Damaged')
  into v_returned_count, v_damaged_count
  from public.kit_deployment_items
  where deployment_id = p_deployment_id;

  update public.kit_deployments
  set
    returned_count = coalesce(v_returned_count, 0),
    damaged_count = coalesce(v_damaged_count, 0),
    note = case
      when coalesce(trim(p_note), '') = '' then note
      when coalesce(trim(note), '') = '' then p_note
      else note || ' | ' || p_note
    end,
    status = case
      when coalesce(v_returned_count, 0) + coalesce(v_damaged_count, 0) >= item_count then 'Completed'
      when coalesce(v_returned_count, 0) + coalesce(v_damaged_count, 0) > 0 then 'Partially Returned'
      else 'Deployed'
    end,
    updated_at = now()
  where id = p_deployment_id
  returning * into v_row;

  return v_row;
end;
$$;
