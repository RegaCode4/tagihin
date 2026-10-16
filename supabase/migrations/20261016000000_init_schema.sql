-- TagihIn: skema awal sesuai ERD 6 tabel + RLS + trigger profiles
-- Jalankan di Supabase SQL Editor atau lewat Supabase CLI (supabase db push).

-- ============ profiles ============
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  phone text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- isi profil untuk akun yang sudah terdaftar sebelum trigger ada
insert into public.profiles (id, name)
select id, split_part(email, '@', 1) from auth.users
on conflict (id) do nothing;

-- ============ rooms ============
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 100),
  description text,
  total_amount bigint not null check (total_amount > 0),
  due_day smallint not null check (due_day between 1 and 28),
  payment_instruction text,
  status text not null default 'active' check (status in ('active', 'completed')),
  start_month date not null
    default (date_trunc('month', timezone('Asia/Jakarta', now())))::date
    check (extract(day from start_month) = 1),
  created_at timestamptz not null default now()
);
create index rooms_owner_idx on public.rooms (owner_id);

-- ============ members ============
create table public.members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  phone text not null check (phone ~ '^628[0-9]{7,11}$'),
  sort_order int not null default 0,
  is_active boolean not null default true,
  deactivated_at timestamptz,
  created_at timestamptz not null default now()
);
create index members_room_idx on public.members (room_id);
-- nomor unik hanya di antara anggota aktif (anggota nonaktif boleh didaftarkan ulang)
create unique index members_room_phone_active_uidx
  on public.members (room_id, phone) where is_active;

-- ============ periods ============
create table public.periods (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  period_month date not null check (extract(day from period_month) = 1),
  due_date date not null,
  total_amount bigint not null check (total_amount > 0),
  created_at timestamptz not null default now(),
  unique (room_id, period_month)
);

-- ============ payments ============
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.periods (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  amount_due bigint not null check (amount_due >= 0),
  status text not null default 'unpaid' check (status in ('unpaid', 'paid')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (period_id, member_id),
  check ((status = 'paid') = (paid_at is not null))
);
create index payments_member_idx on public.payments (member_id);

-- ============ reminder_logs ============
create table public.reminder_logs (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete cascade,
  channel text not null default 'wa_link',
  sent_at timestamptz not null default now()
);
create index reminder_logs_payment_idx on public.reminder_logs (payment_id);

-- ============ Row Level Security ============
alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.members enable row level security;
alter table public.periods enable row level security;
alter table public.payments enable row level security;
alter table public.reminder_logs enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy rooms_owner_all on public.rooms
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy members_owner_all on public.members
  for all to authenticated
  using (exists (select 1 from public.rooms r
                 where r.id = members.room_id and r.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.rooms r
                 where r.id = members.room_id and r.owner_id = (select auth.uid())));

create policy periods_owner_all on public.periods
  for all to authenticated
  using (exists (select 1 from public.rooms r
                 where r.id = periods.room_id and r.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.rooms r
                 where r.id = periods.room_id and r.owner_id = (select auth.uid())));

create policy payments_owner_all on public.payments
  for all to authenticated
  using (exists (select 1 from public.periods p join public.rooms r on r.id = p.room_id
                 where p.id = payments.period_id and r.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.periods p join public.rooms r on r.id = p.room_id
                 where p.id = payments.period_id and r.owner_id = (select auth.uid())));

create policy reminder_logs_owner_all on public.reminder_logs
  for all to authenticated
  using (exists (select 1 from public.payments pay
                 join public.periods p on p.id = pay.period_id
                 join public.rooms r on r.id = p.room_id
                 where pay.id = reminder_logs.payment_id and r.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.payments pay
                 join public.periods p on p.id = pay.period_id
                 join public.rooms r on r.id = p.room_id
                 where pay.id = reminder_logs.payment_id and r.owner_id = (select auth.uid())));
