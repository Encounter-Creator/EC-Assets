create or replace function public.save_settings_user(
  p_user_id uuid,
  p_display_name text default null,
  p_surname text default null,
  p_assigned_location_id uuid default null,
  p_asset_manager_location_id uuid default null,
  p_role text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_user_id is null then
    raise exception 'User is required';
  end if;

  v_full_name := array_to_string(array_remove(array[p_display_name, p_surname], null), ' ');
  v_full_name := nullif(trim(v_full_name), '');

  update public.profiles
  set
    display_name = p_display_name,
    surname = p_surname,
    full_name = v_full_name,
    assigned_location_id = p_assigned_location_id,
    asset_manager_location_id = p_asset_manager_location_id
  where id = p_user_id;

  if p_role is not null then
    delete from public.user_roles where user_id = p_user_id;
    insert into public.user_roles (user_id, role)
    values (p_user_id, p_role);
  end if;

  return jsonb_build_object(
    'user_id', p_user_id,
    'display_name', p_display_name,
    'surname', p_surname,
    'assigned_location_id', p_assigned_location_id,
    'asset_manager_location_id', p_asset_manager_location_id,
    'role', p_role
  );
end;
$$;
