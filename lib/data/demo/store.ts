import type { Appointment, Patient, User } from "../types";
import { createSeedData } from "./seed";

/**
 * In-memory store for demo mode.
 *
 * Pinned to `globalThis` for two reasons: Next's dev server re-evaluates modules
 * on every hot reload (a module-level `let` would reset the data mid-session),
 * and route handlers, server actions and RSC renders must all observe the same
 * writes within a process.
 *
 * Writes survive for the lifetime of the process and no longer — which is
 * exactly what E2E wants, since each run starts from a known state.
 */

export interface DemoStore {
  users: Map<string, User>;
  patients: Map<string, Patient>;
  appointments: Map<string, Appointment>;
  files: Map<string, { name: string; type: string; bytes: ArrayBuffer }>;
  sequence: number;
  seed: number;
}

const STORE_KEY = Symbol.for("carepulse.demo.store");

type GlobalWithStore = typeof globalThis & {
  [STORE_KEY]?: DemoStore;
};

function build(seed: number): DemoStore {
  const { users, patients, appointments } = createSeedData(seed);

  return {
    users: new Map(users.map((u) => [u.id, u])),
    patients: new Map(patients.map((p) => [p.id, p])),
    appointments: new Map(appointments.map((a) => [a.id, a])),
    files: new Map(),
    sequence: 1000,
    seed,
  };
}

export function getDemoStore(seed = 42): DemoStore {
  const g = globalThis as GlobalWithStore;
  if (!g[STORE_KEY] || g[STORE_KEY]!.seed !== seed) {
    g[STORE_KEY] = build(seed);
  }
  return g[STORE_KEY]!;
}

/** Rebuilds the store from the seed. Used by tests and the E2E reset hook. */
export function resetDemoStore(seed = 42): DemoStore {
  const g = globalThis as GlobalWithStore;
  g[STORE_KEY] = build(seed);
  return g[STORE_KEY]!;
}

export function nextDemoId(store: DemoStore, prefix: string): string {
  store.sequence += 1;
  return `${prefix}-${store.sequence}`;
}

/**
 * Deep copy on the way out.
 *
 * Without this, a caller mutating a returned appointment would silently corrupt
 * the store, and React would see the same object identity across renders and
 * skip updates. `structuredClone` is stdlib on Node 17+.
 */
export function clone<T>(value: T): T {
  return structuredClone(value);
}
