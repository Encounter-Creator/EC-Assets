alter table public.approvals
  add column if not exists review_notes text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id);

drop policy if exists approvals_manager_update on public.approvals;
create policy approvals_manager_update
on public.approvals
for update
using (public.is_manager_or_admin())
with check (public.is_manager_or_admin());

drop policy if exists damage_manager_update on public.damage_cases;
create policy damage_manager_update
on public.damage_cases
for update
using (public.is_manager_or_admin())
with check (public.is_manager_or_admin());

create or replace function public.review_approval(
  p_approval_id uuid,
  p_status public.approval_status,
  p_review_notes text default null
)
returns public.approvals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_approval public.approvals;
  v_request_status public.workflow_status;
begin
  if not public.is_manager_or_admin() then
    raise exception 'Not authorized';
  end if;

  v_request_status := case
    when p_status = 'Approved' then 'Approved'::public.workflow_status
    when p_status = 'Declined' then 'Declined'::public.workflow_status
    else 'Pending'::public.workflow_status
  end;

  update public.approvals
  set status = p_status,
      review_notes = p_review_notes,
      reviewed_at = now(),
      reviewed_by = auth.uid()
  where id = p_approval_id
  returning * into v_approval;

  if not found then
    raise exception 'Approval not found';
  end if;

  if v_approval.request_id is not null then
    update public.requests
    set status = v_request_status
    where id = v_approval.request_id;

    if v_approval.approval_type = 'return' then
      update public.return_requests
      set status = case
        when p_status = 'Approved' then 'Accepted'::public.return_status
        when p_status = 'Declined' then 'Declined'::public.return_status
        else 'Pending'::public.return_status
      end
      where request_id = v_approval.request_id;
    end if;
  end if;

  return v_approval;
end;
$$;
