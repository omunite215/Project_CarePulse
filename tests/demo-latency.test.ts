import { beforeEach, describe, expect, it } from "vitest";

import { DemoRepository } from "@/lib/data/demo/demo.repository";
import { resetDemoStore } from "@/lib/data/demo/store";

/**
 * Demo latency exists so the loading skeletons are reachable, which means the
 * thing worth asserting is *which* methods it applies to. Reads sleep so a
 * skeleton has time to paint; writes do not, so booking and the admin actions
 * stay responsive — and so the server-side slot re-check that closes the
 * double-booking race is not slowed down on the path that needs it most.
 *
 * Real elapsed time, not fake timers: `sleep` is a bare `setTimeout` and the
 * behaviour under test is "does this await it", which a mocked clock would
 * answer by construction.
 */

const SEED = 42;
const LATENCY_MS = 60;

/**
 * `setTimeout(…, 60)` can fire a hair under 60 on a loaded machine, so the
 * floor sits below the delay — but an order of magnitude above the sub-1ms an
 * unwrapped fixture read takes, which is the only distinction this needs.
 */
const SLEPT_MS = 50;

async function elapsed(run: () => Promise<unknown>): Promise<number> {
  const start = performance.now();
  await run();
  return performance.now() - start;
}

const READS: ReadonlyArray<[string, (r: DemoRepository) => Promise<unknown>]> = [
  ["getUser", (r) => r.getUser("demo-user")],
  ["getPatientByUserId", (r) => r.getPatientByUserId("demo-user")],
  ["getAppointment", (r) => r.getAppointment("demo-appt-1")],
  ["listAppointments", (r) => r.listAppointments()],
  ["listAppointmentsByUser", (r) => r.listAppointmentsByUser("demo-user")],
  [
    "getBookedSlots",
    (r) => r.getBookedSlots("John Green", new Date().toISOString()),
  ],
];

const WRITES: ReadonlyArray<[string, (r: DemoRepository) => Promise<unknown>]> =
  [
    [
      "createUser",
      (r) =>
        r.createUser({
          name: "Latency Probe",
          email: `latency-${Math.random()}@example.com`,
          phone: "+12025550100",
        }),
    ],
    [
      "updateAppointment",
      (r) => r.updateAppointment("demo-appt-1", { status: "scheduled" }),
    ],
    [
      "uploadIdentificationDocument",
      (r) =>
        r.uploadIdentificationDocument({
          name: "id.png",
          type: "image/png",
          bytes: new ArrayBuffer(8),
        }),
    ],
  ];

beforeEach(() => {
  resetDemoStore(SEED);
});

describe.each(READS)("%s", (_name, read) => {
  it("sleeps when a latency is configured", async () => {
    const repo = new DemoRepository(SEED, LATENCY_MS);

    expect(await elapsed(() => read(repo))).toBeGreaterThanOrEqual(SLEPT_MS);
  });

  it("does not sleep at the constructor default", async () => {
    // The repository contract suite constructs `new DemoRepository(SEED)` with
    // one argument and `pnpm test` never loads `.env`, so this default is what
    // keeps that suite fast.
    const repo = new DemoRepository(SEED);

    expect(await elapsed(() => read(repo))).toBeLessThan(SLEPT_MS);
  });
});

describe.each(WRITES)("%s", (_name, write) => {
  it("stays instant even when a latency is configured", async () => {
    const repo = new DemoRepository(SEED, LATENCY_MS);

    expect(await elapsed(() => write(repo))).toBeLessThan(SLEPT_MS);
  });
});
