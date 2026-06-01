create or replace function public.current_user_home_base_id()
returns uuid
language sql
stable
as $$
  select home_base_id from public.profiles where id = auth.uid()
$$;

create or replace function public.list_standard_recipients()
returns table (
  id uuid,
  full_name text,
  email text,
  role public.app_role,
  home_base text,
  department text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.full_name,
    p.email,
    p.role,
    l.name as home_base,
    d.name as department
  from public.profiles p
  left join public.locations l on l.id = p.home_base_id
  left join public.departments d on d.id = p.department_id
  where p.approved = true
    and p.locked = false
    and (
      public.current_user_role() = 'admin'
      or p.home_base_id = public.current_user_home_base_id()
    )
  order by p.full_name;
$$;

create or replace function public.list_standard_locations()
returns table (
  id uuid,
  name text
)
language sql
stable
security definer
set search_path = public
as $$
  select id, name
  from public.locations
  where active = true
    and name <> 'Traveling'
    and (
      public.current_user_role() = 'admin'
      or id = public.current_user_home_base_id()
    )
  order by name;
$$;

create or replace function public.list_standard_sign_out_assets()
returns table (
  id uuid,
  tag text,
  name text,
  serial_number text,
  state public.asset_state,
  current_location text,
  holder text,
  department text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id,
    a.tag,
    a.name,
    a.serial_number,
    a.state,
    l.name as current_location,
    p.full_name as holder,
    d.name as department
  from public.assets a
  left join public.locations l on l.id = a.current_location_id
  left join public.profiles p on p.id = a.current_holder_id
  left join public.departments d on d.id = a.department_id
  where a.state = 'Available'
    and (
      public.current_user_role() = 'admin'
      or a.current_location_id = public.current_user_home_base_id()
    )
  order by a.name, a.tag;
$$;

create or replace function public.list_standard_sign_in_assets()
returns table (
  id uuid,
  tag text,
  name text,
  serial_number text,
  state public.asset_state,
  current_location text,
  holder text,
  department text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id,
    a.tag,
    a.name,
    a.serial_number,
    a.state,
    l.name as current_location,
    p.full_name as holder,
    d.name as department
  from public.assets a
  left join public.locations l on l.id = a.current_location_id
  left join public.profiles p on p.id = a.current_holder_id
  left join public.departments d on d.id = a.department_id
  where a.state = 'Assigned'
    and (
      public.current_user_role() = 'admin'
      or exists (
        select 1
        from public.profiles holder_profile
        where holder_profile.id = a.current_holder_id
          and holder_profile.home_base_id = public.current_user_home_base_id()
      )
    )
  order by a.name, a.tag;
$$;

create or replace function public.standard_sign_out_assets(
  p_asset_ids uuid[],
  p_holder_id uuid,
  p_note text default null
)
returns table (
  id uuid,
  tag text,
  name text,
  serial_number text,
  state public.asset_state,
  current_location text,
  holder text,
  department text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_holder public.profiles;
  v_traveling_id uuid;
  v_updated_count integer;
begin
  if not public.is_manager_or_admin() then
    raise exception 'Not authorized';
  end if;

  if coalesce(array_length(p_asset_ids, 1), 0) = 0 then
    raise exception 'Select at least one asset';
  end if;

  select *
  into v_holder
  from public.profiles
  where id = p_holder_id
    and approved = true
    and locked = false;

  if not found then
    raise exception 'Recipient not found';
  end if;

  if public.current_user_role() <> 'admin' and v_holder.home_base_id is distinct from public.current_user_home_base_id() then
    raise exception 'Recipient home base does not match manager location';
  end if;

  select id
  into v_traveling_id
  from public.locations
  where name = 'Traveling';

  if v_traveling_id is null then
    raise exception 'Traveling location not configured';
  end if;

  update public.assets a
  set current_holder_id = p_holder_id,
      current_location_id = v_traveling_id,
      state = 'Assigned'
  where a.id = any (p_asset_ids)
    and a.state = 'Available'
    and (
      public.current_user_role() = 'admin'
      or a.current_location_id = public.current_user_home_base_id()
    );

  get diagnostics v_updated_count = row_count;

  if coalesce(v_updated_count, 0) = 0 then
    raise exception 'No eligible assets found for sign out';
  end if;

  insert into public.asset_history (asset_id, action, notes, performed_by)
  select
    a.id,
    'sign_out',
    coalesce(p_note, 'Standard sign-out'),
    auth.uid()
  from public.assets a
  where a.id = any (p_asset_ids)
    and a.current_holder_id = p_holder_id
    and a.state = 'Assigned';

  insert into public.approvals (approval_type, status, assigned_to, payload)
  select
    'recipient',
    'Awaiting Recipient',
    p_holder_id,
    jsonb_build_object(
      'asset_id', a.id,
      'asset_name', a.name,
      'tag', a.tag,
      'assigned_by', auth.uid(),
      'note', p_note
    )
  from public.assets a
  where a.id = any (p_asset_ids)
    and a.current_holder_id = p_holder_id
    and a.state = 'Assigned';

  perform public.queue_notification(
    p_holder_id,
    'Approvals',
    'New asset assignment',
    format('You have %s asset assignment(s) awaiting response.', v_updated_count),
    true,
    '/my-assets',
    null,
    null
  );

  return query
  select
    a.id,
    a.tag,
    a.name,
    a.serial_number,
    a.state,
    l.name as current_location,
    p.full_name as holder,
    d.name as department
  from public.assets a
  left join public.locations l on l.id = a.current_location_id
  left join public.profiles p on p.id = a.current_holder_id
  left join public.departments d on d.id = a.department_id
  where a.id = any (p_asset_ids)
    and a.current_holder_id = p_holder_id
    and a.state = 'Assigned';
end;
$$;

create or replace function public.standard_sign_in_assets(
  p_asset_ids uuid[],
  p_final_location_id uuid,
  p_outcome public.asset_state,
  p_note text default null
)
returns table (
  id uuid,
  tag text,
  name text,
  serial_number text,
  state public.asset_state,
  current_location text,
  holder text,
  department text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asset record;
  v_final_location_name text;
  v_processed_count integer := 0;
begin
  if not public.is_manager_or_admin() then
    raise exception 'Not authorized';
  end if;

  if coalesce(array_length(p_asset_ids, 1), 0) = 0 then
    raise exception 'Select at least one asset';
  end if;

  if p_outcome not in ('Available', 'Damaged') then
    raise exception 'Standard sign-in only supports Available or Damaged';
  end if;

  select name
  into v_final_location_name
  from public.locations
  where id = p_final_location_id
    and active = true;

  if v_final_location_name is null then
    raise exception 'Final location not found';
  end if;

  if public.current_user_role() <> 'admin' and p_final_location_id is distinct from public.current_user_home_base_id() then
    raise exception 'Managers can only sign in to their own location';
  end if;

  for v_asset in
    select a.id, a.name, a.tag, a.current_holder_id
    from public.assets a
    left join public.profiles holder_profile on holder_profile.id = a.current_holder_id
    where a.id = any (p_asset_ids)
      and a.state = 'Assigned'
      and (
        public.current_user_role() = 'admin'
        or holder_profile.home_base_id = public.current_user_home_base_id()
      )
  loop
    v_processed_count := v_processed_count + 1;

    update public.assets
    set current_holder_id = null,
        current_location_id = p_final_location_id,
        state = p_outcome
    where id = v_asset.id;

    insert into public.asset_history (asset_id, action, notes, performed_by)
    values (
      v_asset.id,
      'sign_in',
      coalesce(p_note, format('Standard sign-in to %s', v_final_location_name)),
      auth.uid()
    );

    update public.approvals
    set status = 'Approved',
        review_notes = coalesce(review_notes, 'Closed by standard sign-in'),
        reviewed_at = now(),
        reviewed_by = auth.uid()
    where approval_type = 'recipient'
      and assigned_to = v_asset.current_holder_id
      and status = 'Awaiting Recipient'
      and payload ->> 'asset_id' = v_asset.id::text;

    if p_outcome = 'Damaged' and v_asset.current_holder_id is not null then
      update public.profiles
      set locked = true
      where id = v_asset.current_holder_id;

      insert into public.damage_cases (asset_id, responsible_user_id, status)
      values (v_asset.id, v_asset.current_holder_id, 'Locked');

      perform public.queue_notification(
        v_asset.current_holder_id,
        'Damage',
        'Damage lock activated',
        format('%s (%s) was signed in as damaged and requires your damage form.', v_asset.name, v_asset.tag),
        true,
        '/damage-lock',
        null,
        null
      );
    end if;
  end loop;

  if v_processed_count = 0 then
    raise exception 'No eligible assets found for sign in';
  end if;

  return query
  select
    a.id,
    a.tag,
    a.name,
    a.serial_number,
    a.state,
    l.name as current_location,
    p.full_name as holder,
    d.name as department
  from public.assets a
  left join public.locations l on l.id = a.current_location_id
  left join public.profiles p on p.id = a.current_holder_id
  left join public.departments d on d.id = a.department_id
  where a.id = any (p_asset_ids)
    and a.current_location_id = p_final_location_id
    and a.state = p_outcome;
end;
$$;
