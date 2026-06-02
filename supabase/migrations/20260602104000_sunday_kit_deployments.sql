create table if not exists public.kit_deployments (
  id uuid primary key default gen_random_uuid(),
  kit_reference text not null,
  kit_name text not null,
  item_count integer not null check (item_count >= 0),
  responsible_user_id uuid not null,
  deployed_location_id uuid not null,
  status text not null default 'Deployed',
  returned_count integer not null default 0 check (returned_count >= 0),
  damaged_count integer not null default 0 check (damaged_count >= 0),
  note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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

  return v_row;
end;
$$;

create or replace function public.return_sunday_kit_items(
  p_deployment_id uuid,
  p_returned_count integer,
  p_damaged_count integer,
  p_note text default null
)
returns public.kit_deployments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.kit_deployments;
  v_total_returned integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_deployment_id is null then
    raise exception 'Choose a deployment';
  end if;

  if coalesce(p_returned_count, 0) < 0 or coalesce(p_damaged_count, 0) < 0 then
    raise exception 'Returned and damaged counts must be zero or greater';
  end if;

  select *
  into v_row
  from public.kit_deployments
  where id = p_deployment_id;

  if v_row.id is null then
    raise exception 'Deployment not found';
  end if;

  v_total_returned := coalesce(v_row.returned_count, 0) + coalesce(v_row.damaged_count, 0) + coalesce(p_returned_count, 0) + coalesce(p_damaged_count, 0);
  if v_total_returned > v_row.item_count then
    raise exception 'Returned plus damaged count exceeds kit item count';
  end if;

  update public.kit_deployments
  set
    returned_count = coalesce(returned_count, 0) + coalesce(p_returned_count, 0),
    damaged_count = coalesce(damaged_count, 0) + coalesce(p_damaged_count, 0),
    note = case
      when coalesce(trim(p_note), '') = '' then note
      when coalesce(trim(note), '') = '' then p_note
      else note || ' | ' || p_note
    end,
    status = case
      when v_total_returned >= item_count then 'Completed'
      else 'Partially Returned'
    end,
    updated_at = now()
  where id = p_deployment_id
  returning * into v_row;

  return v_row;
end;
$$;
