create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'asset_manager', 'staff', 'volunteer');
create type public.asset_state as enum ('Available', 'Assigned', 'Traveling', 'Stationed', 'Damaged');
create type public.workflow_status as enum ('Draft', 'Pending', 'Approved', 'Declined', 'In Progress', 'Completed', 'Blocked');
create type public.approval_status as enum ('Pending', 'Approved', 'Declined', 'Request Changes', 'Awaiting Recipient');
create type public.return_status as enum ('Pending', 'Accepted', 'Routed to Intake', 'In Progress', 'Completed', 'Declined');
create type public.damage_status as enum ('Locked', 'Form Pending', 'Form Submitted', 'Under Review', 'Resolved: Available', 'Resolved: Damaged', 'Resolved: Lost');
create type public.notification_channel as enum ('in_app', 'push', 'email');
create type public.notification_category as enum ('Approvals', 'Requests', 'Damage', 'Returns');

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  is_home_base boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key,
  email text not null unique,
  full_name text not null,
  role public.app_role not null,
  home_base_id uuid references public.locations(id),
  department_id uuid references public.departments(id),
  approved boolean not null default false,
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  tag text not null,
  serial_number text not null default 'NA',
  name text not null,
  item_type text not null,
  department_id uuid not null references public.departments(id),
  current_location_id uuid references public.locations(id),
  current_holder_id uuid references public.profiles(id),
  state public.asset_state not null default 'Available',
  description text,
  condition_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists assets_location_tag_key on public.assets(current_location_id, tag);

create table if not exists public.asset_history (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  action text not null,
  notes text,
  performed_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.request_drafts (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references public.profiles(id),
  workflow_type text not null,
  source_location_id uuid references public.locations(id),
  payload jsonb not null default '{}'::jsonb,
  status public.workflow_status not null default 'Draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists request_drafts_one_active_per_type on public.request_drafts(requested_by, workflow_type) where status = 'Draft';

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references public.profiles(id),
  workflow_type text not null,
  source_location_id uuid references public.locations(id),
  status public.workflow_status not null default 'Pending',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.requests(id) on delete cascade,
  approval_type text not null,
  status public.approval_status not null default 'Pending',
  assigned_to uuid references public.profiles(id),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.return_requests (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.requests(id) on delete cascade,
  preferred_return_location_id uuid references public.locations(id),
  status public.return_status not null default 'Pending',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.damage_cases (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id),
  responsible_user_id uuid references public.profiles(id),
  status public.damage_status not null default 'Locked',
  user_statement text,
  resolved_state public.asset_state,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expo_token text not null unique,
  platform text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category public.notification_category not null,
  title text not null,
  body text not null,
  action_url text,
  urgent boolean not null default false,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  channel public.notification_channel not null,
  recipient text not null,
  status text not null default 'queued',
  provider_message_id text,
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);

insert into public.locations (name, is_home_base)
values
  ('Centurion', true),
  ('Krugersdorp', true),
  ('Lanseria', true),
  ('Office', true),
  ('Traveling', false),
  ('Unassigned', true)
on conflict (name) do nothing;

insert into public.departments (name)
values
  ('Production'),
  ('Audio'),
  ('Lighting'),
  ('Prophet')
on conflict (name) do nothing;
