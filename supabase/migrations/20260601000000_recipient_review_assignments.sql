create or replace function public.recipient_review_assignments(
  p_approval_ids uuid[],
  p_decision public.approval_status,
  p_reason text default null
)
returns setof public.approvals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_approval public.approvals;
  v_asset_id uuid;
  v_asset_name text;
  v_tag text;
  v_home_base_id uuid;
  v_updated_count integer := 0;
begin
  if coalesce(array_length(p_approval_ids, 1), 0) = 0 then
    raise exception 'Select at least one assignment';
  end if;

  if p_decision not in ('Approved', 'Declined') then
    raise exception 'Recipients may only approve or decline assignments';
  end if;

  if p_decision = 'Declined' and coalesce(length(trim(p_reason)), 0) = 0 then
    raise exception 'Decline reason is required';
  end if;

  select home_base_id
  into v_home_base_id
  from public.profiles
  where id = auth.uid();

  for v_approval in
    select *
    from public.approvals
    where id = any (p_approval_ids)
      and approval_type = 'recipient'
      and assigned_to = auth.uid()
      and status = 'Awaiting Recipient'
  loop
    v_updated_count := v_updated_count + 1;
    v_asset_id := nullif(v_approval.payload ->> 'asset_id', '')::uuid;
    v_asset_name := coalesce(v_approval.payload ->> 'asset_name', 'Assigned asset');
    v_tag := coalesce(v_approval.payload ->> 'tag', 'Unknown');

    update public.approvals
    set status = p_decision,
        review_notes = case
          when p_decision = 'Declined' then p_reason
          else coalesce(review_notes, 'Recipient accepted assignment')
        end,
        reviewed_at = now(),
        reviewed_by = auth.uid()
    where id = v_approval.id;

    if p_decision = 'Declined' and v_asset_id is not null then
      update public.assets
      set current_holder_id = null,
          current_location_id = v_home_base_id,
          state = 'Available'
      where id = v_asset_id
        and current_holder_id = auth.uid()
        and state = 'Assigned';

      insert into public.asset_history (asset_id, action, notes, performed_by)
      values (
        v_asset_id,
        'recipient_decline',
        coalesce(p_reason, 'Recipient declined assignment'),
        auth.uid()
      );
    end if;

    if p_decision = 'Approved' and v_asset_id is not null then
      insert into public.asset_history (asset_id, action, notes, performed_by)
      values (
        v_asset_id,
        'recipient_approve',
        'Recipient approved assignment',
        auth.uid()
      );
    end if;

    if nullif(v_approval.payload ->> 'assigned_by', '') is not null then
      perform public.queue_notification(
        (v_approval.payload ->> 'assigned_by')::uuid,
        'Approvals',
        case when p_decision = 'Approved' then 'Assignment accepted' else 'Assignment declined' end,
        case
          when p_decision = 'Approved' then format('%s (%s) was accepted by the recipient.', v_asset_name, v_tag)
          else format('%s (%s) was declined by the recipient. Reason: %s', v_asset_name, v_tag, p_reason)
        end,
        true,
        '/approvals',
        null,
        null
      );
    end if;

    if p_decision = 'Declined' then
      insert into public.notifications (user_id, category, title, body, action_url, urgent)
      select
        p.id,
        'Approvals',
        'Assignment declined',
        format('%s (%s) was declined by the recipient. Reason: %s', v_asset_name, v_tag, p_reason),
        '/approvals',
        true
      from public.profiles p
      where p.role = 'admin'
        and p.approved = true
        and p.id <> auth.uid()
        and p.id <> nullif(v_approval.payload ->> 'assigned_by', '')::uuid;
    end if;
  end loop;

  if v_updated_count = 0 then
    raise exception 'No eligible assignments found';
  end if;

  return query
  select a.*
  from public.approvals a
  where a.id = any (p_approval_ids)
    and a.assigned_to = auth.uid();
end;
$$;
