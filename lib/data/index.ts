import "server-only";

import { getServerEnv } from "@/lib/env";
import { DemoRepository } from "./demo/demo.repository";
import type { DataRepository } from "./repository";

/**
 * Picks the repository implementation from the environment.
 *
 * The Appwrite adapter is imported lazily so demo mode never pulls
 * `node-appwrite` into the module graph — which also means a clone with no
 * credentials never has a chance to throw on a missing endpoint.
 *
 * Memoised on `globalThis` for the same reason the demo store is: Next
 * re-evaluates modules across hot reloads.
 */

const REPO_KEY = Symbol.for("carepulse.repository");

type GlobalWithRepo = typeof globalThis & {
  [REPO_KEY]?: DataRepository;
};

export async function getRepository(): Promise<DataRepository> {
  const g = globalThis as GlobalWithRepo;
  if (g[REPO_KEY]) return g[REPO_KEY]!;

  const env = getServerEnv();

  if (env.dataSource === "appwrite") {
    const { AppwriteRepository } = await import(
      "./appwrite/appwrite.repository"
    );
    g[REPO_KEY] = new AppwriteRepository();
  } else {
    g[REPO_KEY] = new DemoRepository(env.DEMO_SEED, env.DEMO_LATENCY_MS);
  }

  return g[REPO_KEY]!;
}

/** Test seam: lets the contract suite swap in either implementation. */
export function setRepositoryForTests(repo: DataRepository | null) {
  const g = globalThis as GlobalWithRepo;
  if (repo) g[REPO_KEY] = repo;
  else delete g[REPO_KEY];
}

export type { DataRepository } from "./repository";
