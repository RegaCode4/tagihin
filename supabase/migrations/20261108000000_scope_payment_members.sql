-- An owner can write a payment only when its period and member share a room.
alter policy payments_owner_all on public.payments
  with check (
    exists (
      select 1
      from public.periods p
      join public.rooms r on r.id = p.room_id
      join public.members m on m.room_id = p.room_id
      where p.id = payments.period_id
        and m.id = payments.member_id
        and r.owner_id = (select auth.uid())
    )
  );

-- The Vercel cron calls this RPC as service_role. Do not rely on default ACLs.
grant execute on function public.refresh_current_period(uuid) to service_role;
