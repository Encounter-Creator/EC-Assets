create or replace function public.list_return_request_monitor()
returns table (
  id uuid,
  request_id uuid,
  preferred_return_location text,
  status public.return_status,
  note text,
  created_at timestamptz,
  workflow_status public.workflow_status
)
language sql
stable
security definer
set search_path = public
as $$
  select
    rr.id,
    rr.request_id,
    l.name as preferred_return_location,
    rr.status,
    rr.note,
    rr.created_at,
    r.status as workflow_status
  from public.return_requests rr
  left join public.locations l on l.id = rr.preferred_return_location_id
  left join public.requests r on r.id = rr.request_id
  where public.is_manager_or_admin()
  order by rr.created_at desc;
$$;
