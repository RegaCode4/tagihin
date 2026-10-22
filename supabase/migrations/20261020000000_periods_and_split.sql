-- TagihIn Minggu 4: pembagian rata + periode bulanan otomatis
-- Jalankan SETELAH migrasi skema awal (20261016000000_init_schema.sql).

-- ============ pembagian rata ============
-- Aturan: bagian = floor(total / n); sisa pembagian dibebankan ke anggota urutan pertama.
create or replace function public.split_equal(p_total bigint, p_count int)
returns bigint[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  base bigint;
  arr bigint[];
begin
  if p_total is null or p_total <= 0 then
    raise exception 'total harus lebih dari 0';
  end if;
  if p_count is null or p_count < 1 then
    raise exception 'jumlah anggota minimal 1';
  end if;
  base := p_total / p_count;
  arr := array_fill(base, array[p_count]);
  arr[1] := base + (p_total - base * p_count);
  return arr;
end;
$$;

-- ============ periode bulan berjalan untuk satu room ============
-- Dipanggil dari aplikasi (rpc) saat room dibuka. SECURITY INVOKER: RLS tetap berlaku,
-- jadi pengguna hanya bisa memproses room miliknya. Idempotent.
-- Aturan (PRD FR-05/FR-06):
--  * periode dibuat untuk bulan berjalan (zona Asia/Jakarta), hanya bila room aktif dan punya anggota aktif
--  * nominal dan jatuh tempo disalin dari room
--  * dihitung ulang (anggota/nominal berubah) HANYA selama belum ada pembayaran berstatus lunas
--  * pembayaran yang sudah ada dipertahankan (id tidak berubah) agar log pengingat tidak hilang
create or replace function public.refresh_current_period(p_room uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  r public.rooms%rowtype;
  v_month date := date_trunc('month', timezone('Asia/Jakarta', now()))::date;
  v_due date;
  v_period uuid;
  v_n int;
  v_shares bigint[];
begin
  select * into r from public.rooms where id = p_room;
  if not found or r.status <> 'active' then
    return null;
  end if;

  select count(*) into v_n from public.members where room_id = p_room and is_active;
  if v_n = 0 then
    return null;
  end if;

  v_due := make_date(extract(year from v_month)::int, extract(month from v_month)::int, r.due_day);

  insert into public.periods (room_id, period_month, due_date, total_amount)
  values (p_room, v_month, v_due, r.total_amount)
  on conflict (room_id, period_month) do nothing;

  select id into v_period from public.periods
  where room_id = p_room and period_month = v_month;

  -- sudah ada yang lunas: jangan hitung ulang periode berjalan
  if exists (select 1 from public.payments where period_id = v_period and status = 'paid') then
    return v_period;
  end if;

  update public.periods
     set total_amount = r.total_amount, due_date = v_due
   where id = v_period;

  v_shares := public.split_equal(r.total_amount, v_n);

  insert into public.payments (period_id, member_id, amount_due)
  select v_period, a.id, v_shares[a.rn]
  from (
    select m.id, row_number() over (order by m.sort_order, m.created_at, m.id)::int as rn
    from public.members m
    where m.room_id = p_room and m.is_active
  ) a
  on conflict (period_id, member_id) do update
    set amount_due = excluded.amount_due
    where public.payments.amount_due is distinct from excluded.amount_due;

  delete from public.payments
  where period_id = v_period
    and member_id not in (select id from public.members where room_id = p_room and is_active);

  return v_period;
end;
$$;

revoke all on function public.refresh_current_period(uuid) from public, anon;
grant execute on function public.refresh_current_period(uuid) to authenticated;

-- ============ untuk cron: proses semua room aktif ============
-- SECURITY DEFINER (melewati RLS), TIDAK boleh dipanggil dari klien.
create or replace function public.generate_all_current_periods()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  rid uuid;
  n int := 0;
begin
  for rid in select id from public.rooms where status = 'active' loop
    if public.refresh_current_period(rid) is not null then
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;

revoke all on function public.generate_all_current_periods() from public, anon, authenticated;

-- ============ penjadwalan (jalankan manual setelah mengaktifkan ekstensi pg_cron) ============
-- Dashboard Supabase: Database > Extensions > pg_cron. Jam di bawah memakai UTC:
-- 17:05 UTC = 00:05 WIB. Aman dijalankan tiap hari karena fungsinya idempotent.
--
-- select cron.schedule(
--   'tagihin-periode-bulanan',
--   '5 17 * * *',
--   $$ select public.generate_all_current_periods(); $$
-- );
