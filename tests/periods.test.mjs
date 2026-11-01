import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const nativeRequire = createRequire(import.meta.url);
const projectRoot = fileURLToPath(new URL("../", import.meta.url));

// Execute the real page, client component, and route with database boundaries
// replaced by fixtures. These tests never contact Supabase or run a real cron.
function loadSource(relativePath, mocks) {
  const cache = new Map();

  function load(filename) {
    if (cache.has(filename)) return cache.get(filename);
    const compiledModule = { exports: {} };
    const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText;

    function localRequire(name) {
      const mock = mocks(name);
      if (mock !== undefined) return mock;
      if (name.startsWith(".")) {
        const base = path.resolve(path.dirname(filename), name);
        const resolved = [base, `${base}.ts`, `${base}.tsx`].find(
          (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
        );
        assert.ok(resolved, `Cannot resolve ${name}`);
        return load(resolved);
      }
      return nativeRequire(name);
    }

    new Function("require", "module", "exports", code)(localRequire, compiledModule, compiledModule.exports);
    cache.set(filename, compiledModule.exports);
    return compiledModule.exports;
  }

  return load(path.resolve(projectRoot, relativePath));
}

function roomFixture(options = {}) {
  const month = `${new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
  }).format(new Date())}-01`;
  const room = {
    id: "room-1", owner_id: "owner-1", title: "WiFi Uji",
    total_amount: 250000, due_day: 1, status: "active",
    description: null, payment_instruction: null, ...options.room,
  };
  const members = options.members ?? [
    { id: "member-1", name: "Anggota Uji", phone: "6281234567890", sort_order: 1, is_active: true },
  ];
  const newPeriod = () => ({
    id: "period-1", room_id: room.id, period_month: month, due_date: month,
    total_amount: room.total_amount,
    payments: options.payments ?? members.map((member) => ({
      id: `payment-${member.id}`, member_id: member.id,
      amount_due: room.total_amount / members.length, status: "unpaid", paid_at: null,
    })),
  });
  const state = { period: options.existingPeriod ? newPeriod() : null, events: [] };
  const user = options.signedOut ? null : { id: options.userId ?? room.owner_id };
  const client = {
    rpc: async (name, args) => {
      state.events.push("refresh");
      assert.equal(name, "refresh_current_period");
      assert.deepEqual(args, { p_room: room.id });
      if (options.syncError) return { data: null, error: { message: "fixture sync failure" } };
      if (members.length > 0) state.period ??= newPeriod();
      return { data: state.period?.id ?? null, error: null };
    },
    from(table) {
      state.events.push(`read:${table}`);
      const filters = {};
      const query = {
        select() { return query; },
        eq(key, value) { filters[key] = value; return query; },
        order() { return Promise.resolve({ data: options.membersError ? null : members, error: options.membersError ? { message: "fixture members failure" } : null }); },
        maybeSingle() {
          assert.equal(filters.room_id, room.id);
          assert.equal(filters.period_month, month);
          return Promise.resolve({ data: options.periodError ? null : state.period, error: options.periodError ? { message: "fixture period failure" } : null });
        },
      };
      return query;
    },
  };
  const actions = new Proxy({}, { get: () => async function fixtureAction() {} });
  const { default: Page } = loadSource("src/app/dashboard/rooms/[id]/page.tsx", (name) => {
    if (name === "next/link") return { __esModule: true, default: function FixtureLink({ href, children }) { return React.createElement("a", { href }, children); } };
    if (name === "next/navigation") return { redirect(location) { throw new Error(`redirect:${location}`); }, notFound() { throw new Error("notFound"); } };
    if (name.endsWith("/supabase/server-client")) return { createClient: async () => client, getCachedUser: async () => user };
    if (name.endsWith("/supabase/queries")) return { getRoomById: async () => room };
    if (name.endsWith("/actions")) return actions;
    return undefined;
  });
  return {
    state,
    async render() {
      return renderToStaticMarkup(await Page({
        params: Promise.resolve({ id: room.id }), searchParams: Promise.resolve({}),
      }));
    },
  };
}

test("opening a room with a member creates the missing period before reading payments", async () => {
  const fixture = roomFixture();
  const html = await fixture.render();
  assert.match(html, /Anggota Uji/);
  assert.match(html, /Tandai lunas/);
  assert.match(html, /Ingatkan/);
  assert.doesNotMatch(html, /Belum ada periode tagihan aktif/);
  assert.ok(fixture.state.events.indexOf("refresh") < fixture.state.events.indexOf("read:periods"));
});

test("existing periods still display payment controls", async () => {
  const html = await roomFixture({ existingPeriod: true }).render();
  assert.match(html, /Tandai lunas/);
  assert.match(html, /Ingatkan/);
});

test("a new member waits until next month when the existing period has a paid payment", async () => {
  const html = await roomFixture({
    existingPeriod: true,
    members: [
      { id: "member-1", name: "Anggota Lama", phone: "6281234567890", sort_order: 1, is_active: true },
      { id: "member-2", name: "Anggota Baru", phone: "6281234567891", sort_order: 2, is_active: true },
    ],
    payments: [{ id: "payment-1", member_id: "member-1", amount_due: 250000, status: "paid", paid_at: "2026-10-01T00:00:00Z" }],
  }).render();
  assert.match(html, /Anggota Lama/);
  assert.match(html, /Anggota Baru/);
  assert.match(html, /Bulan depan/);
  assert.equal((html.match(/type="checkbox"/g) ?? []).length, 1);
  assert.doesNotMatch(html, />Ingatkan</);
});

test("a sync failure keeps member management visible and reports the failure", async () => {
  const html = await roomFixture({ syncError: true }).render();
  assert.match(html, /Anggota Uji/);
  assert.match(html, /Ubah data anggota/);
  assert.match(html, /belum berhasil disinkronkan/);
  assert.doesNotMatch(html, /type="checkbox"/);
  assert.doesNotMatch(html, />Ingatkan</);
  assert.doesNotMatch(html, /Bulan depan/);
});

test("a sync failure does not hide an existing period", async () => {
  const html = await roomFixture({ syncError: true, existingPeriod: true }).render();
  assert.match(html, /belum berhasil disinkronkan/);
  assert.match(html, /Tandai lunas/);
});

test("a period read failure is shown while the member list remains accessible", async () => {
  const html = await roomFixture({ periodError: true }).render();
  assert.match(html, /Data tagihan gagal dimuat/);
  assert.match(html, /Anggota Uji/);
  assert.doesNotMatch(html, /type="checkbox"/);
});

test("a member read failure is not presented as an empty room", async () => {
  const html = await roomFixture({ membersError: true }).render();
  assert.match(html, /Daftar anggota gagal dimuat/);
  assert.doesNotMatch(html, /Belum ada anggota di room ini/);
  assert.doesNotMatch(html, /0 anggota/);
});

test("a completed room never creates a new period, but still displays its members", async () => {
  const fixture = roomFixture({ room: { status: "completed" } });
  const html = await fixture.render();
  assert.match(html, /Anggota Uji/);
  assert.match(html, /Room sudah selesai/);
  assert.ok(!fixture.state.events.includes("refresh"));
});

test("a room without members has a helpful empty state", async () => {
  const html = await roomFixture({ members: [] }).render();
  assert.match(html, /Tambahkan anggota/);
  assert.doesNotMatch(html, /role="alert"/);
  assert.doesNotMatch(html, /type="checkbox"/);
});

test("authorization runs before period creation or member reads", async () => {
  for (const options of [{ signedOut: true }, { userId: "someone-else" }]) {
    const fixture = roomFixture(options);
    await assert.rejects(fixture.render, /redirect:|notFound/);
    assert.deepEqual(fixture.state.events, []);
  }
});

function cronFixture(options = {}) {
  const env = {
    CRON_SECRET: "fixture-secret", NEXT_PUBLIC_SUPABASE_URL: "https://fixture.invalid",
    SUPABASE_SERVICE_ROLE_KEY: "fixture-service-key", ...options.env,
  };
  let clientCreated = false;
  const client = {
    from() {
      return { select() { return this; }, eq() { return Promise.resolve({ data: options.rooms ?? [{ id: "room-1" }], error: options.fetchError ? { message: "fixture read failure" } : null }); } };
    },
    rpc: async (_name, { p_room }) => ({ data: options.skipped?.includes(p_room) ? null : "period-1", error: options.failed?.includes(p_room) ? { message: "fixture RPC failure" } : null }),
  };
  // Only the named environment keys are replaced, then restored after each call.
  const exports = loadSource("src/app/api/cron/refresh-period/route.ts", (name) => {
    if (name === "@supabase/supabase-js") return { createClient() { clientCreated = true; return client; } };
    return undefined;
  });
  return {
    async run(authorization = "Bearer fixture-secret") {
      const previous = {};
      for (const key of Object.keys(env)) {
        previous[key] = process.env[key];
        if (env[key] === undefined) delete process.env[key];
        else process.env[key] = env[key];
      }
      try {
        return await exports.GET(new Request("https://fixture.invalid/api/cron/refresh-period", { headers: { authorization } }));
      } finally {
        for (const key of Object.keys(env)) {
          if (previous[key] === undefined) delete process.env[key];
          else process.env[key] = previous[key];
        }
      }
    },
    wasClientCreated: () => clientCreated,
  };
}

test("cron rejects an unset secret, including Bearer undefined", async () => {
  const fixture = cronFixture({ env: { CRON_SECRET: undefined } });
  const response = await fixture.run("Bearer undefined");
  assert.equal(response.status, 401);
  assert.equal(fixture.wasClientCreated(), false);
});

test("cron rejects an invalid token before accessing Supabase", async () => {
  const fixture = cronFixture();
  assert.equal((await fixture.run("Bearer wrong")).status, 401);
  assert.equal(fixture.wasClientCreated(), false);
});

test("cron reports partial RPC failures with HTTP 500", async () => {
  const response = await cronFixture({ rooms: [{ id: "room-1" }, { id: "room-2" }], failed: ["room-2"] }).run();
  assert.equal(response.status, 500);
  const result = await response.json();
  assert.equal(result.success, false);
  assert.equal(result.refreshed, 1);
  assert.equal(result.failed, 1);
});

test("cron distinguishes refreshed periods from rooms without members", async () => {
  const response = await cronFixture({ rooms: [{ id: "room-1" }, { id: "room-2" }], skipped: ["room-2"] }).run();
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.success, true);
  assert.equal(result.refreshed, 1);
  assert.equal(result.skipped, 1);
  assert.equal(result.failed, 0);
});

test("cron reports missing server credentials and room query errors", async () => {
  for (const options of [{ env: { SUPABASE_SERVICE_ROLE_KEY: undefined } }, { fetchError: true }]) {
    const response = await cronFixture(options).run();
    assert.equal(response.status, 500);
    assert.equal((await response.json()).success, false);
  }
});
