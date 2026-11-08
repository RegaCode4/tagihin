import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test, { after, before } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { splitEqual } from "../lib/split.ts";

const db = new PGlite();
const ownerA = "00000000-0000-4000-8000-000000000001";
const ownerB = "00000000-0000-4000-8000-000000000002";
const roomA = "00000000-0000-4000-8000-000000000011";
const roomB = "00000000-0000-4000-8000-000000000012";
const secondRoomA = "00000000-0000-4000-8000-000000000013";
const memberA = "00000000-0000-4000-8000-000000000021";
const memberB = "00000000-0000-4000-8000-000000000022";
const secondRoomMember = "00000000-0000-4000-8000-000000000023";
const member2A = "00000000-0000-4000-8000-000000000024";
const member3A = "00000000-0000-4000-8000-000000000025";

before(async () => {
  // Minimal Supabase role and JWT context. All product SQL comes from migrations.
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
  `);
  const migrations = new URL("../supabase/migrations/", import.meta.url);
  for (const filename of (await readdir(migrations)).filter((name) => name.endsWith(".sql")).sort()) {
    await db.exec(await readFile(new URL(filename, migrations), "utf8"));
  }
  await db.exec(`
    grant select, insert, update, delete on all tables in schema public
      to anon, authenticated, service_role;
    insert into auth.users (id, email) values
      ('${ownerA}', 'a@example.invalid'), ('${ownerB}', 'b@example.invalid');
    insert into public.rooms (id, owner_id, title, total_amount, due_day) values
      ('${roomA}', '${ownerA}', 'Iuran A', 100001, 10),
      ('${roomB}', '${ownerB}', 'Iuran B', 90000, 10),
      ('${secondRoomA}', '${ownerA}', 'Iuran A lainnya', 90000, 10);
    insert into public.members (id, room_id, name, phone, sort_order) values
      ('${memberA}', '${roomA}', 'Anggota A', '6280000000001', 1),
      ('${member2A}', '${roomA}', 'Anggota A2', '6280000000002', 2),
      ('${member3A}', '${roomA}', 'Anggota A3', '6280000000003', 3),
      ('${memberB}', '${roomB}', 'Anggota B', '6280000000004', 1),
      ('${secondRoomMember}', '${secondRoomA}', 'Anggota room kedua', '6280000000005', 1);
  `);
});

after(() => db.close());

async function asRole(role, ownerId, run) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${role}`);
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [ownerId]);
    return run(tx);
  });
}

async function refresh(tx, roomId) {
  const { rows } = await tx.query("select public.refresh_current_period($1) as id", [roomId]);
  return rows[0].id;
}

test("RLS isolates all six tables and blocks cross-owner updates and refresh", async () => {
  const periodA = await asRole("authenticated", ownerA, (tx) => refresh(tx, roomA));
  const periodB = await asRole("authenticated", ownerB, (tx) => refresh(tx, roomB));
  assert.ok(periodA && periodB);
  await db.exec("insert into public.reminder_logs (payment_id) select id from public.payments");

  await asRole("authenticated", ownerB, async (tx) => {
    const expectedRows = {
      profiles: 1, rooms: 1, members: 1, periods: 1, payments: 1, reminder_logs: 1,
    };
    for (const [table, count] of Object.entries(expectedRows)) {
      const { rows } = await tx.query(`select count(*)::int as count from public.${table}`);
      assert.equal(rows[0].count, count, table);
    }
    assert.equal((await tx.query("select id from public.rooms")).rows[0].id, roomB);
    assert.equal((await tx.query("update public.rooms set title = 'Ubah' where id = $1 returning id", [roomA])).rows.length, 0);
    assert.equal((await tx.query("delete from public.payments where period_id = $1 returning id", [periodA])).rows.length, 0);
    assert.equal(await refresh(tx, roomA), null);
  });
  await asRole("anon", "", async (tx) => {
    assert.equal((await tx.query("select id from public.rooms")).rows.length, 0);
  });
  await assert.rejects(asRole("anon", "", (tx) => refresh(tx, roomA)), { code: "42501" });
  await assert.rejects(asRole("authenticated", ownerB, (tx) => tx.query("select public.generate_all_current_periods()")), { code: "42501" });
});

test("payment writes cannot reference a member from another room", async () => {
  const periodA = await asRole("authenticated", ownerA, (tx) => refresh(tx, roomA));
  for (const otherMember of [memberB, secondRoomMember]) {
    await assert.rejects(asRole("authenticated", ownerA, (tx) => tx.query(
      "insert into public.payments (period_id, member_id, amount_due) values ($1, $2, 1)", [periodA, otherMember],
    )), { code: "42501" });
    await assert.rejects(asRole("authenticated", ownerA, (tx) => tx.query(
      "update public.payments set member_id = $1 where period_id = $2 and member_id = $3", [otherMember, periodA, memberA],
    )), { code: "42501" });
  }
});

test("SQL and TypeScript agree on integer splits and preserve the full rupiah total", async () => {
  for (const [total, count, expected] of [
    [90_000, 3, [30_000, 30_000, 30_000]],
    [100_001, 3, [33_335, 33_333, 33_333]],
    [1, 3, [1, 0, 0]],
    [99, 1, [99]],
  ]) {
    const { rows } = await db.query("select public.split_equal($1, $2) as shares", [total, count]);
    const shares = rows[0].shares.map(Number);
    assert.deepEqual(shares, expected);
    assert.deepEqual(splitEqual(total, count), expected);
    assert.equal(shares.reduce((sum, amount) => sum + amount, 0), total);
  }
  for (const [total, count] of [[0, 3], [-5, 2], [10, 0]]) {
    assert.throws(() => splitEqual(total, count), RangeError);
    await assert.rejects(db.query("select public.split_equal($1, $2)", [total, count]), { code: "P0001" });
  }
});

test("current WIB refresh is idempotent and preserves paid and previous periods", async () => {
  await asRole("authenticated", ownerA, async (tx) => {
    const monthSql = "date_trunc('month', timezone('Asia/Jakarta', now()))::date";
    // Start at the rollover: the previous period exists, the current one does not.
    await tx.query(`delete from public.periods where room_id = $1 and period_month = ${monthSql}`, [roomA]);
    const { rows: previous } = await tx.query(`
      insert into public.periods (room_id, period_month, due_date, total_amount)
      values ($1, (${monthSql} - interval '1 month')::date, (${monthSql} - interval '1 month')::date + 9, 75000)
      returning id
    `, [roomA]);
    await tx.query(`
      insert into public.payments (period_id, member_id, amount_due, status, paid_at)
      values ($1, $2, 75000, 'paid', now())
    `, [previous[0].id, memberA]);
    const periodId = await refresh(tx, roomA);
    const getPayments = async (id) => (await tx.query(`
      select p.id, p.member_id, p.amount_due::int, p.status, p.paid_at
      from public.payments p join public.members m on m.id = p.member_id
      where p.period_id = $1 order by m.sort_order
    `, [id])).rows;
    const original = await getPayments(periodId);
    assert.deepEqual(original.map((payment) => payment.amount_due), [33_335, 33_333, 33_333]);
    assert.equal(await refresh(tx, roomA), periodId);
    assert.deepEqual(await getPayments(periodId), original);
    await tx.query("update public.rooms set total_amount = 120000 where id = $1", [roomA]);
    await refresh(tx, roomA);
    const recalculated = await getPayments(periodId);
    assert.deepEqual(recalculated.map((payment) => payment.amount_due), [40_000, 40_000, 40_000]);
    assert.deepEqual(recalculated.map((payment) => payment.id), original.map((payment) => payment.id));

    await tx.query("update public.payments set status = 'paid', paid_at = now() where id = $1", [original[0].id]);
    const paid = await getPayments(periodId);
    const past = await getPayments(previous[0].id);
    await tx.query("update public.rooms set total_amount = 150000, due_day = 15 where id = $1", [roomA]);
    await tx.query("update public.members set is_active = false where id = $1", [member3A]);
    assert.equal(await refresh(tx, roomA), periodId);
    assert.deepEqual(await getPayments(periodId), paid);
    assert.deepEqual(await getPayments(previous[0].id), past);
    const { rows } = await tx.query(`
      select total_amount::int, period_month = ${monthSql} as in_current_month,
        extract(day from due_date)::int as due_day
      from public.periods where room_id = $1 order by period_month
    `, [roomA]);
    assert.deepEqual(rows, [
      { total_amount: 75000, in_current_month: false, due_day: 10 },
      { total_amount: 120000, in_current_month: true, due_day: 10 },
    ]);
  });
});

test("the cron role can refresh a room and skips completed rooms", async () => {
  await asRole("service_role", "", async (tx) => {
    assert.ok(await refresh(tx, roomB));
    await tx.query("update public.rooms set status = 'completed' where id = $1", [roomB]);
    assert.equal(await refresh(tx, roomB), null);
  });
});
