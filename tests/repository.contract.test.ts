import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AppwriteRepository } from "@/lib/data/appwrite/appwrite.repository";
import { DemoRepository } from "@/lib/data/demo/demo.repository";
import { DEMO_USER_ID } from "@/lib/data/demo/seed";
import { resetDemoStore } from "@/lib/data/demo/store";
import type { DataRepository } from "@/lib/data/repository";
import type { Appointment } from "@/lib/data/types";
import { AppError } from "@/lib/errors";

/**
 * One suite, run against every `DataRepository`.
 *
 * The point of the repository seam is that demo and Appwrite are behaviourally
 * interchangeable. That claim is only worth anything if it is tested against
 * both, so every assertion below seeds the data it needs and asserts something
 * relative — no fixture ids, no absolute counts, no assumption that the store
 * starts empty. Fixture-specific expectations live in their own block at the
 * bottom and run for demo only.
 *
 * The Appwrite pass is skipped unless all seven credentials are present, so a
 * cold clone still gets the demo pass. It writes to a real project and deletes
 * everything it created in `afterAll`.
 */

const SEED = 42;

const APPWRITE_ENV_KEYS = [
  "NEXT_PUBLIC_ENDPOINT",
  "PROJECT_ID",
  "API_KEY",
  "DATABASE_ID",
  "PATIENT_COLLECTION_ID",
  "APPOINTMENT_COLLECTION_ID",
  "NEXT_PUBLIC_BUCKET_ID",
] as const;

const appwriteConfigured = APPWRITE_ENV_KEYS.every(
  (key) => (process.env[key] ?? "").trim() !== "",
);

/*
 * `tests/setup.ts` pins DEMO_MODE=true for every suite, which makes
 * `requireAppwriteEnv()` throw. This is the one file that needs the live path,
 * and `lib/env.ts` memoises on first call — so the flag has to be cleared
 * before any test body runs. Vitest isolates module registries per file, so
 * this does not leak into the other suites.
 */
if (appwriteConfigured) delete process.env.DEMO_MODE;
else {
  // Vitest does not copy .env into process.env, so a populated .env is not
  // enough — `pnpm test` always runs demo-only. Say so, rather than letting a
  // green run imply the live adapter was covered.
  console.warn(
    "Appwrite credentials not in process.env — the live pass is skipped. " +
      "Run `pnpm test:appwrite` to include it.",
  );
}

// The Appwrite pass makes several sequential round trips per test, which the
// 5s default does not cover. Demo is unaffected — it just never gets close.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 120_000 });

/** Distinguishes this run's rows from any left behind by a crashed earlier one. */
const RUN_ID = Math.random().toString(36).slice(2, 8);
const RUN_STARTED_AT = new Date(Date.now() - 60_000).toISOString();

let sequence = 0;
const nextSequence = () => (sequence += 1);

const implementations: {
  name: string;
  make: () => DataRepository;
  /** Rebuilt per test where the backing store allows it. */
  reset: () => void;
}[] = [
  {
    name: "demo",
    make: () => new DemoRepository(SEED),
    reset: () => resetDemoStore(SEED),
  },
];

if (appwriteConfigured) {
  implementations.push({
    name: "appwrite",
    make: () => new AppwriteRepository(),
    // A live project is shared, not rebuildable. Every assertion below is
    // written to tolerate pre-existing rows for exactly this reason.
    reset: () => {},
  });
}

describe.each(implementations)(
  "DataRepository contract: $name",
  ({ make, reset }) => {
    let repo: DataRepository;

    beforeEach(() => {
      reset();
      repo = make();
    });

    describe("createUser", () => {
      it("creates a user and returns it", async () => {
        const input = newUserInput();
        const user = await repo.createUser(input);

        expect(user.id).toBeTruthy();
        expect(user.email).toBe(input.email);
        expect(user.name).toBe("Contract Tester");
      });

      it("is idempotent on a duplicate email", async () => {
        const input = newUserInput();
        const first = await repo.createUser(input);
        const second = await repo.createUser({
          ...input,
          name: "Someone Else",
        });

        // Re-entering the same email on the onboarding form must resume the
        // existing user rather than erroring out.
        expect(second.id).toBe(first.id);
      });

      it("returns a user, never undefined", async () => {
        // Guards the original bug: createUser assigned its result and never
        // returned it, so the happy path resolved to undefined.
        const user = await repo.createUser(newUserInput());
        expect(user).toBeDefined();
        expect(user.id).not.toBe("");
      });
    });

    describe("getUser", () => {
      it("returns null for an unknown id rather than throwing", async () => {
        expect(await repo.getUser("does-not-exist")).toBeNull();
      });

      it("round-trips a created user", async () => {
        const created = await repo.createUser(newUserInput());
        const fetched = await repo.getUser(created.id);

        expect(fetched?.id).toBe(created.id);
        expect(fetched?.email).toBe(created.email);
      });
    });

    describe("registerPatient", () => {
      it("rejects registration for an unknown user", async () => {
        await expect(
          repo.registerPatient({ ...patientInput(), userId: "nope" }),
        ).rejects.toBeInstanceOf(AppError);
      });

      it("stores and returns the patient", async () => {
        const user = await repo.createUser(newUserInput());
        const patient = await repo.registerPatient({
          ...patientInput(),
          userId: user.id,
          email: user.email,
        });

        expect(patient.id).toBeTruthy();
        expect(patient.userId).toBe(user.id);
        expect(patient.gender).toBe("female");
        expect(patient.treatmentConsent).toBe(true);

        const fetched = await repo.getPatientByUserId(user.id);
        expect(fetched?.id).toBe(patient.id);
      });

      it("returns null for a user with no patient record", async () => {
        const user = await repo.createUser(newUserInput());
        expect(await repo.getPatientByUserId(user.id)).toBeNull();
      });

      it("rejects a second registration for the same user", async () => {
        // Without this, `getPatientByUserId` silently returns whichever
        // duplicate the backend happens to order first.
        const user = await repo.createUser(newUserInput());
        await repo.registerPatient({
          ...patientInput(),
          userId: user.id,
          email: user.email,
        });

        await expect(
          repo.registerPatient({ ...patientInput(), userId: user.id }),
        ).rejects.toBeInstanceOf(AppError);
      });
    });

    describe("appointments", () => {
      it("creates an appointment against an existing patient", async () => {
        const { patientId, userId } = await seedPatient(repo);

        const appointment = await repo.createAppointment({
          userId,
          patientId,
          primaryPhysician: "John Green",
          schedule: slotIn(nextWindow()),
          reason: "Contract test",
          note: null,
          status: "pending",
        });

        expect(appointment.status).toBe("pending");
        expect(appointment.patient.id).toBe(patientId);
        expect(appointment.cancellationReason).toBeNull();
      });

      it("returns null for a missing appointment", async () => {
        expect(await repo.getAppointment("nope")).toBeNull();
      });

      it("updates status and cancellation reason", async () => {
        const { patientId, userId } = await seedPatient(repo);
        const created = await repo.createAppointment({
          userId,
          patientId,
          primaryPhysician: "Jane Powell",
          schedule: slotIn(nextWindow()),
          reason: "Contract test",
          note: null,
          status: "pending",
        });

        const cancelled = await repo.updateAppointment(created.id, {
          status: "cancelled",
          cancellationReason: "Changed my mind",
        });

        expect(cancelled.status).toBe("cancelled");
        expect(cancelled.cancellationReason).toBe("Changed my mind");
        // Untouched fields must survive a partial update.
        expect(cancelled.reason).toBe("Contract test");
      });

      it("throws for an update to a missing appointment", async () => {
        await expect(
          repo.updateAppointment("nope", { status: "scheduled" }),
        ).rejects.toBeInstanceOf(AppError);
      });

      it("lists a user's own appointments newest first", async () => {
        const { patientId, userId } = await seedPatient(repo);
        const window = nextWindow();

        const earlier = await repo.createAppointment({
          userId,
          patientId,
          primaryPhysician: "John Green",
          schedule: slotIn(window, 0),
          reason: "Earlier",
          note: null,
          status: "pending",
        });
        const later = await repo.createAppointment({
          userId,
          patientId,
          primaryPhysician: "John Green",
          schedule: slotIn(window, 2),
          reason: "Later",
          note: null,
          status: "pending",
        });

        const mine = await repo.listAppointmentsByUser(userId);

        expect(mine.map((a) => a.id)).toEqual([later.id, earlier.id]);
      });
    });

    /*
     * Every read path has to return a usable patient, not just `createAppointment`.
     *
     * The admin table's Patient column, the CSV export and the patient's own
     * list all render `appointment.patient.name`. Appwrite returns a
     * relationship as a bare id string unless the read explicitly selects it,
     * and the old `toAppointment` cast that string straight to a document — so
     * every field silently mapped to `""` and the column rendered blank. The
     * suite passed throughout, because the only assertion on a patient's fields
     * was against the value `createAppointment` echoes back.
     */
    describe("patient expansion", () => {
      const NAME = "Expanded Patient";

      async function seedOne() {
        const seeded = await seedPatient(repo, { name: NAME });
        const window = nextWindow();
        const created = await repo.createAppointment({
          userId: seeded.userId,
          patientId: seeded.patientId,
          primaryPhysician: "John Green",
          schedule: slotIn(window),
          reason: "Expansion test",
          note: null,
          status: "pending",
        });
        return { ...seeded, created, window };
      }

      function expectExpanded(appointment: Appointment | undefined, patientId: string) {
        expect(appointment).toBeDefined();
        expect(appointment!.patient.id).toBe(patientId);
        expect(appointment!.patient.name).toBe(NAME);
        expect(appointment!.patient.email).toBeTruthy();
      }

      it("expands the patient on createAppointment", async () => {
        const { created, patientId } = await seedOne();
        expectExpanded(created, patientId);
      });

      it("expands the patient on getAppointment", async () => {
        const { created, patientId } = await seedOne();
        expectExpanded((await repo.getAppointment(created.id)) ?? undefined, patientId);
      });

      it("expands the patient on listAppointments", async () => {
        const { created, patientId, window } = await seedOne();
        const listed = await repo.listAppointments({ ...window, pageSize: 100 });
        expectExpanded(
          listed.documents.find((a) => a.id === created.id),
          patientId,
        );
      });

      it("expands the patient on listAppointmentsByUser", async () => {
        const { created, patientId, userId } = await seedOne();
        const mine = await repo.listAppointmentsByUser(userId);
        expectExpanded(
          mine.find((a) => a.id === created.id),
          patientId,
        );
      });

      it("expands the patient on updateAppointment", async () => {
        const { created, patientId } = await seedOne();
        const updated = await repo.updateAppointment(created.id, {
          status: "scheduled",
        });
        expectExpanded(updated, patientId);
      });
    });

    describe("listAppointments", () => {
      it("reports counts over the whole set, not the filtered page", async () => {
        const { patientId, userId } = await seedPatient(repo);
        const window = nextWindow();

        for (const offset of [0, 2, 4]) {
          await repo.createAppointment({
            userId,
            patientId,
            primaryPhysician: "John Green",
            schedule: slotIn(window, offset),
            reason: "Counts test",
            note: null,
            status: "pending",
          });
        }

        const page = await repo.listAppointments({ ...window, pageSize: 1 });

        expect(page.documents).toHaveLength(1);
        expect(page.totalCount).toBe(3);

        // This is the invariant that makes the StatCards meaningful: they
        // describe the clinic, not whatever happens to be on screen. The three
        // rows just created are pending, so the clinic-wide pending count has
        // to exceed the single row on this page.
        const total =
          page.counts.scheduledCount +
          page.counts.pendingCount +
          page.counts.cancelledCount;

        expect(page.counts.pendingCount).toBeGreaterThanOrEqual(3);
        expect(total).toBeGreaterThan(page.documents.length);
      });

      it("keeps counts consistent with a status-filtered total", async () => {
        const { counts } = await repo.listAppointments();
        const cancelled = await repo.listAppointments({
          status: "cancelled",
          pageSize: 1,
        });

        // Counts must be server-side totals, not a tally of some fetched slice.
        expect(cancelled.totalCount).toBe(counts.cancelledCount);
      });

      it("filters by status", async () => {
        const { patientId, userId } = await seedPatient(repo);
        const window = nextWindow();

        await repo.createAppointment({
          userId,
          patientId,
          primaryPhysician: "John Green",
          schedule: slotIn(window),
          reason: "Status filter",
          note: null,
          status: "pending",
        });

        const result = await repo.listAppointments({
          ...window,
          status: "cancelled",
          pageSize: 100,
        });

        expect(result.documents.every((a) => a.status === "cancelled")).toBe(
          true,
        );
        expect(result.totalCount).toBe(0);
      });

      it("paginates without overlap", async () => {
        const { patientId, userId } = await seedPatient(repo);
        const window = nextWindow();

        for (const offset of [0, 2, 4, 6]) {
          await repo.createAppointment({
            userId,
            patientId,
            primaryPhysician: "John Green",
            schedule: slotIn(window, offset),
            reason: "Pagination",
            note: null,
            status: "pending",
          });
        }

        const first = await repo.listAppointments({
          ...window,
          page: 1,
          pageSize: 2,
          sort: "schedule",
          direction: "asc",
        });
        const second = await repo.listAppointments({
          ...window,
          page: 2,
          pageSize: 2,
          sort: "schedule",
          direction: "asc",
        });

        expect(first.documents).toHaveLength(2);
        expect(second.documents).toHaveLength(2);

        const overlap = first.documents.filter((a) =>
          second.documents.some((b) => b.id === a.id),
        );
        expect(overlap).toHaveLength(0);
      });

      it("sorts by schedule in both directions", async () => {
        const { patientId, userId } = await seedPatient(repo);
        const window = nextWindow();

        for (const offset of [4, 0, 2]) {
          await repo.createAppointment({
            userId,
            patientId,
            primaryPhysician: "John Green",
            schedule: slotIn(window, offset),
            reason: "Sort by schedule",
            note: null,
            status: "pending",
          });
        }

        const ascending = await repo.listAppointments({
          ...window,
          sort: "schedule",
          direction: "asc",
          pageSize: 100,
        });
        const schedules = ascending.documents.map((a) => a.schedule);

        expect(schedules).toEqual(schedules.toSorted());

        const descending = await repo.listAppointments({
          ...window,
          sort: "schedule",
          direction: "desc",
          pageSize: 100,
        });

        expect(descending.documents.map((a) => a.schedule)).toEqual(
          schedules.toReversed(),
        );
      });

      /*
       * `AppointmentQuery.search` promises a free-text match against patient
       * name, patient email, doctor and reason. Appwrite cannot search across
       * the `patient` relationship, so the adapter has to denormalise those
       * fields onto the appointment document — these four cases are what force
       * that, and they are the reason the divergence survived: the suite only
       * ever ran against demo.
       */
      describe("search", () => {
        it("matches the patient name", async () => {
          const token = uniqueToken("name");
          const { patientId, userId } = await seedPatient(repo, {
            name: `Aaron ${token}`,
          });
          const created = await repo.createAppointment({
            userId,
            patientId,
            primaryPhysician: "John Green",
            schedule: slotIn(nextWindow()),
            reason: "Search by patient name",
            note: null,
            status: "pending",
          });

          const found = await repo.listAppointments({
            search: token,
            pageSize: 100,
          });

          expect(found.documents.map((a) => a.id)).toContain(created.id);
        });

        it("matches the patient email", async () => {
          const token = uniqueToken("email");
          const { patientId, userId } = await seedPatient(repo, {
            email: `${token}@example.com`,
          });
          const created = await repo.createAppointment({
            userId,
            patientId,
            primaryPhysician: "John Green",
            schedule: slotIn(nextWindow()),
            reason: "Search by patient email",
            note: null,
            status: "pending",
          });

          const found = await repo.listAppointments({
            search: token,
            pageSize: 100,
          });

          expect(found.documents.map((a) => a.id)).toContain(created.id);
        });

        it("matches the doctor", async () => {
          const token = uniqueToken("doc");
          const { patientId, userId } = await seedPatient(repo);
          const created = await repo.createAppointment({
            userId,
            patientId,
            primaryPhysician: `Doctor ${token}`,
            schedule: slotIn(nextWindow()),
            reason: "Search by doctor",
            note: null,
            status: "pending",
          });

          const found = await repo.listAppointments({
            search: token,
            pageSize: 100,
          });

          expect(found.documents.map((a) => a.id)).toContain(created.id);
        });

        it("matches the reason", async () => {
          const token = uniqueToken("reason");
          const { patientId, userId } = await seedPatient(repo);
          const created = await repo.createAppointment({
            userId,
            patientId,
            primaryPhysician: "John Green",
            schedule: slotIn(nextWindow()),
            reason: `Routine ${token} follow up`,
            note: null,
            status: "pending",
          });

          const found = await repo.listAppointments({
            search: token,
            pageSize: 100,
          });

          expect(found.documents.map((a) => a.id)).toContain(created.id);
        });

        it("returns nothing for a term that matches no appointment", async () => {
          const found = await repo.listAppointments({
            search: uniqueToken("absent"),
            pageSize: 100,
          });

          expect(found.documents).toHaveLength(0);
          expect(found.totalCount).toBe(0);
        });
      });

      /*
       * `sort=patient` is accepted by lib/api/schemas.ts, so it has to do
       * something. Creation order is deliberately the reverse of alphabetical
       * order: an implementation that quietly falls back to `$createdAt` gets
       * the opposite answer rather than an accidentally-correct one.
       */
      it("sorts by patient name in both directions", async () => {
        const window = nextWindow();

        const zsofia = await seedPatient(repo, { name: "Zsofia Zylstra" });
        const zsofiaAppointment = await repo.createAppointment({
          userId: zsofia.userId,
          patientId: zsofia.patientId,
          primaryPhysician: "John Green",
          schedule: slotIn(window, 0),
          reason: "Sort by patient",
          note: null,
          status: "pending",
        });

        const aaron = await seedPatient(repo, { name: "Aaron Aaltonen" });
        const aaronAppointment = await repo.createAppointment({
          userId: aaron.userId,
          patientId: aaron.patientId,
          primaryPhysician: "John Green",
          schedule: slotIn(window, 2),
          reason: "Sort by patient",
          note: null,
          status: "pending",
        });

        const ascending = await repo.listAppointments({
          ...window,
          sort: "patient",
          direction: "asc",
          pageSize: 100,
        });

        expect(ascending.documents.map((a) => a.id)).toEqual([
          aaronAppointment.id,
          zsofiaAppointment.id,
        ]);

        const descending = await repo.listAppointments({
          ...window,
          sort: "patient",
          direction: "desc",
          pageSize: 100,
        });

        expect(descending.documents.map((a) => a.id)).toEqual([
          zsofiaAppointment.id,
          aaronAppointment.id,
        ]);
      });
    });

    describe("getBookedSlots", () => {
      it("reports a booked slot for the doctor and day", async () => {
        const { patientId, userId } = await seedPatient(repo);
        const doctor = `Doctor ${uniqueToken("slot")}`;
        const schedule = slotIn(nextWindow());

        await repo.createAppointment({
          userId,
          patientId,
          primaryPhysician: doctor,
          schedule,
          reason: "Slot test",
          note: null,
          status: "pending",
        });

        const booked = await repo.getBookedSlots(doctor, schedule);
        expect(booked.map((iso) => new Date(iso).toISOString())).toContain(
          new Date(schedule).toISOString(),
        );
      });

      it("frees the slot once cancelled", async () => {
        const { patientId, userId } = await seedPatient(repo);
        const doctor = `Doctor ${uniqueToken("free")}`;
        const schedule = slotIn(nextWindow());

        const created = await repo.createAppointment({
          userId,
          patientId,
          primaryPhysician: doctor,
          schedule,
          reason: "Slot test",
          note: null,
          status: "pending",
        });

        await repo.updateAppointment(created.id, { status: "cancelled" });

        const booked = await repo.getBookedSlots(doctor, schedule);
        expect(booked).not.toContain(schedule);
      });

      it("does not leak other doctors' bookings", async () => {
        const { patientId, userId } = await seedPatient(repo);
        const schedule = slotIn(nextWindow());

        await repo.createAppointment({
          userId,
          patientId,
          primaryPhysician: `Doctor ${uniqueToken("mine")}`,
          schedule,
          reason: "Slot test",
          note: null,
          status: "pending",
        });

        const other = await repo.getBookedSlots(
          `Doctor ${uniqueToken("other")}`,
          schedule,
        );
        expect(other).not.toContain(schedule);
      });
    });

    describe("isolation", () => {
      it("does not expose internal state by reference", async () => {
        const { patientId, userId } = await seedPatient(repo);
        const created = await repo.createAppointment({
          userId,
          patientId,
          primaryPhysician: "John Green",
          schedule: slotIn(nextWindow()),
          reason: "Isolation test",
          note: null,
          status: "pending",
        });

        const first = await repo.getAppointment(created.id);
        first!.reason = "mutated by caller";

        const again = await repo.getAppointment(created.id);
        expect(again!.reason).toBe("Isolation test");
      });
    });

    describe("uploadIdentificationDocument", () => {
      it("returns an id and a url", async () => {
        const uploaded = await repo.uploadIdentificationDocument({
          name: `id-card-${RUN_ID}.png`,
          type: "image/png",
          bytes: pngBytes(),
        });

        expect(uploaded.id).toBeTruthy();
        expect(uploaded.url).toMatch(/^(https?:)?\/?\//);
      });
    });
  },
);

/* --------------------------- demo-only fixtures --------------------------- */

/**
 * Expectations about the seeded fixtures themselves, not about the contract.
 * These are what the E2E, screenshot and responsive suites depend on, so they
 * are worth pinning — but they cannot hold against a live project.
 */
describe("demo fixtures", () => {
  let repo: DemoRepository;

  beforeEach(() => {
    resetDemoStore(SEED);
    repo = new DemoRepository(SEED);
  });

  it("round-trips the seeded user", async () => {
    expect((await repo.getUser(DEMO_USER_ID))?.id).toBe(DEMO_USER_ID);
  });

  it("has the fixed seeded status mix", async () => {
    const { counts } = await repo.listAppointments();
    expect(counts).toEqual({
      scheduledCount: 8,
      pendingCount: 6,
      cancelledCount: 3,
    });
  });

  it("exposes the appointment the E2E suite navigates to", async () => {
    expect(await repo.getAppointment("demo-appt-1")).not.toBeNull();
  });
});

/* ------------------------------- teardown -------------------------------- */

/**
 * Deletes everything this run wrote to the live project, by creation time
 * rather than by tracked id — a test that fails midway still gets cleaned up,
 * and so does anything an earlier crashed run left behind within the window.
 */
afterAll(async () => {
  if (!appwriteConfigured) return;

  const { Query } = await import("node-appwrite");
  const { getAppwrite } = await import("@/lib/data/appwrite/client");
  const { databases, storage, users, ids } = getAppwrite();

  const since = Query.greaterThanEqual("$createdAt", RUN_STARTED_AT);

  // Appointments before patients: an appointment holds the relationship.
  for (const collectionId of [ids.appointmentCollectionId, ids.patientCollectionId]) {
    for (;;) {
      const page = await databases.listDocuments({
        databaseId: ids.databaseId,
        collectionId,
        queries: [since, Query.limit(100)],
      });
      if (page.documents.length === 0) break;
      await Promise.all(
        page.documents.map((doc) =>
          databases.deleteDocument({
            databaseId: ids.databaseId,
            collectionId,
            documentId: doc.$id,
          }),
        ),
      );
      if (page.documents.length < 100) break;
    }
  }

  const createdUsers = await users.list({ queries: [since, Query.limit(100)] });
  await Promise.all(
    createdUsers.users.map((user) => users.delete({ userId: user.$id })),
  );

  const files = await storage.listFiles({
    bucketId: ids.bucketId,
    queries: [since, Query.limit(100)],
  });
  await Promise.all(
    files.files.map((file) =>
      storage.deleteFile({ bucketId: ids.bucketId, fileId: file.$id }),
    ),
  );
}, 120_000);

/* ------------------------------- helpers -------------------------------- */

/**
 * A distinctive single word, safe for both matchers: demo does a substring
 * `includes()`, Appwrite tokenises for a fulltext index — so anything with
 * punctuation in it would match one and not the other.
 */
function uniqueToken(label: string): string {
  return `zqx${RUN_ID}${label}${nextSequence()}`;
}

function newUserInput() {
  const n = nextSequence();
  return {
    name: "Contract Tester",
    email: `contract-${RUN_ID}-${n}@example.com`,
    // Appwrite enforces uniqueness on phone as well as email, so a shared
    // number would make the second user in a run collide.
    phone: `+1202555${String(n).padStart(4, "0")}`,
  };
}

function patientInput() {
  return {
    userId: "",
    name: "Contract Tester",
    email: `contract-${RUN_ID}-${nextSequence()}@example.com`,
    phone: "+12025550999",
    birthDate: new Date("1990-01-01T00:00:00.000Z").toISOString(),
    gender: "female" as const,
    address: "1 Test Street, Testville",
    occupation: "Tester",
    emergencyContactName: "Next Of Kin",
    emergencyContactNumber: "+12025550888",
    primaryPhysician: "John Green",
    insuranceProvider: "Testing Mutual",
    insurancePolicyNumber: "POL-000001",
    allergies: null,
    currentMedication: null,
    familyMedicalHistory: null,
    pastMedicalHistory: null,
    identificationType: "Passport",
    identificationNumber: "ID-1",
    identificationDocumentId: null,
    identificationDocumentUrl: null,
    privacyConsent: true,
    treatmentConsent: true,
    disclosureConsent: true,
  };
}

async function seedPatient(
  repo: DataRepository,
  overrides: { name?: string; email?: string } = {},
) {
  const user = await repo.createUser(newUserInput());
  const patient = await repo.registerPatient({
    ...patientInput(),
    userId: user.id,
    name: overrides.name ?? "Appointment Owner",
    email: overrides.email ?? user.email,
  });
  return { userId: user.id, patientId: patient.id };
}

/**
 * A private hour far in the future, so date-range queries see only the rows one
 * test created even when the collection is shared. The per-run day offset keeps
 * concurrent or crashed runs from colliding.
 */
const RUN_DAY_OFFSET = Math.floor(Math.random() * 20_000);
let windowIndex = 0;

function nextWindow(): { from: string; to: string } {
  const day = new Date(Date.UTC(2099, 0, 1));
  day.setUTCDate(day.getUTCDate() + RUN_DAY_OFFSET);
  day.setUTCHours(windowIndex++ % 24, 0, 0, 0);

  const from = new Date(day);
  const to = new Date(day.getTime() + 59 * 60_000);
  return { from: from.toISOString(), to: to.toISOString() };
}

/** A slot inside a window, offset in minutes from its start. */
function slotIn(window: { from: string }, offsetMinutes = 0): string {
  return new Date(
    new Date(window.from).getTime() + offsetMinutes * 60_000,
  ).toISOString();
}

/**
 * A real 1x1 PNG. The bucket now enforces an extension allow-list, and Appwrite
 * sniffs content, so an empty ArrayBuffer is rejected.
 */
function pngBytes(): ArrayBuffer {
  const base64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";
  const buffer = Buffer.from(base64, "base64");
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
}
