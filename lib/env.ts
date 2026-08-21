import "server-only";

import { z } from "zod";

/**
 * Server-side environment.
 *
 * The original project used `process.env.X!` non-null assertions inside
 * `appwrite.config.ts`, so a missing variable produced an opaque SDK throw at
 * module-import time. This validates once, fails loudly, and — crucially —
 * decides which data source the app runs against.
 *
 * Demo mode is the DEFAULT. If the Appwrite variables are absent the app runs
 * against seeded in-memory fixtures instead of refusing to boot, which is what
 * makes a cold `git clone && pnpm install && pnpm dev` work.
 */

const nonEmpty = z.string().trim().min(1);

const AppwriteEnvSchema = z.object({
  NEXT_PUBLIC_ENDPOINT: z.url("NEXT_PUBLIC_ENDPOINT must be a valid URL"),
  PROJECT_ID: nonEmpty,
  API_KEY: nonEmpty,
  DATABASE_ID: nonEmpty,
  PATIENT_COLLECTION_ID: nonEmpty,
  APPOINTMENT_COLLECTION_ID: nonEmpty,
  NEXT_PUBLIC_BUCKET_ID: nonEmpty,
});

const BaseEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  /**
   * Admin passkey. Server-only on purpose — the reference implementation shipped
   * this as `NEXT_PUBLIC_ADMIN_PASSKEY` and compared it in the browser, which
   * means anyone could read it out of the JS bundle.
   */
  ADMIN_PASSKEY: z
    .string()
    .regex(/^\d{6}$/, "ADMIN_PASSKEY must be exactly 6 digits")
    .default("123456"),

  /** Secret used to sign the admin session cookie. */
  ADMIN_SESSION_SECRET: z
    .string()
    .min(32, "ADMIN_SESSION_SECRET must be at least 32 characters")
    .default("carepulse-development-only-session-secret-change-me"),

  /** Deterministic fixture seed. Fixed so screenshots and E2E runs match. */
  DEMO_SEED: z.coerce.number().int().default(42),

  /** Forces demo mode even when Appwrite credentials are present. */
  DEMO_MODE: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

export type DataSource = "appwrite" | "demo";

export type ServerEnv = z.infer<typeof BaseEnvSchema> & {
  dataSource: DataSource;
  appwrite: z.infer<typeof AppwriteEnvSchema> | null;
};

let cached: ServerEnv | null = null;

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((i) => `  • ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
}

export function getServerEnv(): ServerEnv {
  if (cached) return cached;

  const base = BaseEnvSchema.safeParse(process.env);
  if (!base.success) {
    throw new Error(
      `Invalid environment configuration:\n${formatIssues(base.error)}`,
    );
  }

  const forced = base.data.DEMO_MODE === true;
  const appwriteParsed = AppwriteEnvSchema.safeParse(process.env);

  // Any Appwrite variable being set signals intent to use Appwrite. In that
  // case a partial configuration is a mistake worth surfacing, not silently
  // falling back to fixtures.
  const appwriteAttempted = [
    "NEXT_PUBLIC_ENDPOINT",
    "PROJECT_ID",
    "API_KEY",
    "DATABASE_ID",
    "PATIENT_COLLECTION_ID",
    "APPOINTMENT_COLLECTION_ID",
    "NEXT_PUBLIC_BUCKET_ID",
  ].some((key) => {
    const v = process.env[key];
    return typeof v === "string" && v.trim() !== "";
  });

  if (!forced && appwriteAttempted && !appwriteParsed.success) {
    throw new Error(
      "Appwrite environment variables are partially set, so demo mode was not " +
        `assumed. Fix or remove them:\n${formatIssues(appwriteParsed.error)}`,
    );
  }

  const useAppwrite = !forced && appwriteParsed.success;

  cached = {
    ...base.data,
    dataSource: useAppwrite ? "appwrite" : "demo",
    appwrite: useAppwrite ? appwriteParsed.data : null,
  };

  return cached;
}

/** True when the app is serving seeded fixtures rather than a real backend. */
export function isDemoMode(): boolean {
  return getServerEnv().dataSource === "demo";
}

/**
 * Appwrite config, or a clear throw. Only the Appwrite adapter calls this, so
 * demo-mode code paths can never trip it.
 */
export function requireAppwriteEnv() {
  const env = getServerEnv();
  if (!env.appwrite) {
    throw new Error(
      "Appwrite is not configured. Set the Appwrite variables in .env.local, " +
        "or leave them unset to run in demo mode.",
    );
  }
  return env.appwrite;
}
