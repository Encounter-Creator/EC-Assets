create table if not exists public.kit_members (
  id uuid primary key default gen_random_uuid(),
  kit_id uuid not null references public.kits(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (kit_id, asset_id)
);

create index if not exists kit_members_kit_id_sort_order_idx on public.kit_members (kit_id, sort_order);
create index if not exists kit_members_asset_id_idx on public.kit_members (asset_id);

create or replace function public.list_settings_kits()
returns table (
  id uuid,
  name text,
  home_base text,
  active boolean,
  item_count integer
)
language sql
security definer
set search_path = public
as $$
  select
    k.id,
    k.name,
    k.home_base,
    k.active,
    coalesce(nullif(count(km.id), 0), greatest(coalesce(k.item_count, 0), 0))::integer as item_count
  from public.kits k
  left join public.kit_members km on km.kit_id = k.id
  group by k.id, k.name, k.home_base, k.active, k.item_count
  order by k.active desc, k.name asc;
$$;

create or replace function public.list_settings_kit_members(
  p_kit_id uuid
)
returns table (
  id uuid,
  kit_id uuid,
  asset_id uuid,
  asset_code text,
  asset_name text,
  serial_number text,
  status text,
  current_location text,
  department text,
  sort_order integer
)
language sql
security definer
set search_path = public
as $$
  select
    km.id,
    km.kit_id,
    km.asset_id,
    coalesce(a.code, 'No tag') as asset_code,
    coalesce(a.name, 'Unnamed asset') as asset_name,
    a.serial_number,
    coalesce(a.status, 'unknown') as status,
    l.name as current_location,
    d.name as department,
    km.sort_order
  from public.kit_members km
  join public.assets a on a.id = km.asset_id
  left join public.locations l on l.id = a.current_location_id
  left join public.departments d on d.id = a.department_id
  where km.kit_id = p_kit_id
  order by km.sort_order asc, coalesce(a.name, ''), coalesce(a.code, '');
$$;

create or replace function public.save_settings_kit_members(
  p_kit_id uuid,
  p_asset_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kit_id uuid;
  v_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select k.id into v_kit_id
  from public.kits k
  where k.id = p_kit_id;

  if v_kit_id is null then
    raise exception 'Kit not found';
  end if;

  delete from public.kit_members
  where kit_id = p_kit_id;

  if coalesce(array_length(p_asset_ids, 1), 0) > 0 then
    insert into public.kit_members (
      kit_id,
      asset_id,
      sort_order
    )
    select
      p_kit_id,
      selected.asset_id,
      selected.sort_order
    from (
      select
        asset_id,
        min(sort_order)::integer as sort_order
      from unnest(p_asset_ids) with ordinality as picked(asset_id, sort_order)
      group by asset_id
    ) as selected
    join public.assets a on a.id = selected.asset_id
    order by selected.sort_order;
  end if;

  select count(*)::integer
  into v_count
  from public.kit_members
  where kit_id = p_kit_id;

  update public.kits
  set item_count = v_count
  where id = p_kit_id;

  return v_count;
end;
$$;

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
  v_member_count integer := 0;
  v_kit_id uuid := null;
  v_member record;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if coalesce(trim(p_kit_reference), '') = '' or coalesce(trim(p_kit_name), '') = '' then
    raise exception 'Choose a kit';
  end if;

  if p_responsible_user_id is null then
    raise exception 'Choose a responsible user';
  end if;

  if p_location_id is null then
    raise exception 'Choose a deployment location';
  end if;

  if p_kit_reference ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    v_kit_id := p_kit_reference::uuid;
  end if;

  if v_kit_id is not null then
    select count(*)::integer
    into v_member_count
    from public.kit_members
    where kit_id = v_kit_id;
  end if;

  if v_member_count <= 0 and coalesce(p_item_count, 0) <= 0 then
    raise exception 'Kit item count must be greater than zero';
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
    case when v_member_count > 0 then v_member_count else p_item_count end,
    p_responsible_user_id,
    p_location_id,
    p_note
  )
  returning * into v_row;

  if v_member_count > 0 then
    for v_member in
      select
        km.asset_id,
        km.sort_order,
        a.code,
        a.name,
        a.serial_number
      from public.kit_members km
      join public.assets a on a.id = km.asset_id
      where km.kit_id = v_kit_id
      order by km.sort_order asc
    loop
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
        v_member.asset_id,
        coalesce(v_member.code, 'No tag'),
        coalesce(v_member.name, 'Unnamed asset'),
        v_member.serial_number,
        v_member.sort_order,
        'Pending'
      );
    end loop;
  else
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
  end if;

  return v_row;
end;
$$;
