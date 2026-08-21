import { beforeEach, describe, expect, it } from "vitest";

import { DemoRepository } from "@/lib/data/demo/demo.repository";
import { DEMO_USER_ID } from "@/lib/data/demo/seed";
import { resetDemoStore } from "@/lib/data/demo/store";
import type { DataRepository } from "@/lib/data/repository";
import { AppError } from "@/lib/errors";

/**
 * One suite, run against any `DataRepository`.
 *
 * The point of the repository seam is that demo and Appwrite are behaviourally
 * interchangeable. That claim is only worth anything if it is tested, so this
 * file asserts the contract rather than an implementation. Pointing it at a
 * live Appwrite project is a matter of pushing a second entry onto
 * `implementations` below.
 */

const SEED = 42;

const implementations: { name: string; make: () => DataRepository }[] = [
  { name: "demo", make: () => new DemoRepository(SEED) },
];

function newUserInput(suffix = "") {
  return {
    name: "Contract Tester",
    email: `contract${suffix}@example.com`,
    phone: "+12025550999",
  };
}

describe.each(implementations)("DataRepository contract: $name", ({ make }) => {
  let repo: DataRepository;

  beforeEach(() => {
    resetDemoStore(SEED);
    repo = make();
  });

  describe("createUser", () => {
    it("creates a user and returns it", async () => {
      const user = await repo.createUser(newUserInput());

      expect(user.id).toBeTruthy();
      expect(user.email).toBe("contract@example.com");
      expect(user.name).toBe("Contract Tester");
    });

    it("is idempotent on a duplicate email", async () => {
      const first = await repo.createUser(newUserInput());
      const second = await repo.createUser({
        ...newUserInput(),
        name: "Someone Else",
      });

      // Re-entering the same email on the onboarding form must resume the
      // existing user rather than erroring out.
      expect(second.id).toBe(first.id);
    });

    it("returns a user, never undefined", async () => {
      // Guards the original bug: createUser assigned its result and never
      // returned it, so the happy path resolved to undefined.
      const user = await repo.createUser(newUserInput("-defined"));
      expect(user).toBeDefined();
      expect(user.id).not.toBe("");
    });
  });

  describe("getUser", () => {
    it("returns null for an unknown id rather than throwing", async () => {
      expect(await repo.getUser("does-not-exist")).toBeNull();
    });

    it("round-trips a seeded user", async () => {
      const user = await repo.getUser(DEMO_USER_ID);
      expect(user?.id).toBe(DEMO_USER_ID);
    });
  });

  describe("registerPatient", () => {
    it("rejects registration for an unknown user", async () => {
      await expect(
        repo.registerPatient({ ...patientInput(), userId: "nope" }),
      ).rejects.toBeInstanceOf(AppError);
    });

    it("stores and returns the patient", async () => {
      const user = await repo.createUser(newUserInput("-reg"));
      const patient = await repo.registerPatient({
        ...patientInput(),
        userId: user.id,
      });

      expect(patient.id).toBeTruthy();
      expect(patient.userId).toBe(user.id);
      expect(patient.gender).toBe("female");
      expect(patient.treatmentConsent).toBe(true);

      const fetched = await repo.getPatientByUserId(user.id);
      expect(fetched?.id).toBe(patient.id);
    });

    it("returns null for a user with no patient record", async () => {
      const user = await repo.createUser(newUserInput("-nopatient"));
      expect(await repo.getPatientByUserId(user.id)).toBeNull();
    });
  });

  describe("appointments", () => {
    it("creates an appointment against an existing patient", async () => {
      const { patientId, userId } = await seedPatient(repo);
      const schedule = tomorrowAt(10, 0);

      const appointment = await repo.createAppointment({
        userId,
        patientId,
        primaryPhysician: "John Green",
        schedule,
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
        schedule: tomorrowAt(11, 0),
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
  });

  describe("listAppointments", () => {
    it("reports counts over the whole set, not the page", async () => {
      const page = await repo.listAppointments({ pageSize: 2 });

      expect(page.documents).toHaveLength(2);

      const total =
        page.counts.scheduledCount +
        page.counts.pendingCount +
        page.counts.cancelledCount;

      // This is the invariant that makes the StatCards meaningful: they
      // describe the clinic, not whatever happens to be on screen.
      expect(total).toBeGreaterThan(page.documents.length);
    });

    it("has the fixed seeded status mix", async () => {
      const { counts } = await repo.listAppointments();
      expect(counts).toEqual({
        scheduledCount: 8,
        pendingCount: 6,
        cancelledCount: 3,
      });
    });

    it("filters by status", async () => {
      const result = await repo.listAppointments({
        status: "cancelled",
        pageSize: 100,
      });
      expect(result.documents.length).toBeGreaterThan(0);
      expect(result.documents.every((a) => a.status === "cancelled")).toBe(true);
    });

    it("paginates without overlap", async () => {
      const first = await repo.listAppointments({ page: 1, pageSize: 5 });
      const second = await repo.listAppointments({ page: 2, pageSize: 5 });

      const overlap = first.documents.filter((a) =>
        second.documents.some((b) => b.id === a.id),
      );
      expect(overlap).toHaveLength(0);
    });
  });

  describe("getBookedSlots", () => {
    it("reports a booked slot for the doctor and day", async () => {
      const { patientId, userId } = await seedPatient(repo);
      const schedule = tomorrowAt(14, 30);

      await repo.createAppointment({
        userId,
        patientId,
        primaryPhysician: "Alyana Cruz",
        schedule,
        reason: "Slot test",
        note: null,
        status: "pending",
      });

      const booked = await repo.getBookedSlots("Alyana Cruz", schedule);
      expect(booked.map((iso) => new Date(iso).toISOString())).toContain(
        new Date(schedule).toISOString(),
      );
    });

    it("frees the slot once cancelled", async () => {
      const { patientId, userId } = await seedPatient(repo);
      const schedule = tomorrowAt(15, 0);

      const created = await repo.createAppointment({
        userId,
        patientId,
        primaryPhysician: "Hardik Sharma",
        schedule,
        reason: "Slot test",
        note: null,
        status: "pending",
      });

      await repo.updateAppointment(created.id, { status: "cancelled" });

      const booked = await repo.getBookedSlots("Hardik Sharma", schedule);
      expect(booked).not.toContain(schedule);
    });

    it("does not leak other doctors' bookings", async () => {
      const { patientId, userId } = await seedPatient(repo);
      const schedule = tomorrowAt(16, 0);

      await repo.createAppointment({
        userId,
        patientId,
        primaryPhysician: "Evan Peter",
        schedule,
        reason: "Slot test",
        note: null,
        status: "pending",
      });

      const other = await repo.getBookedSlots("Jasmine Lee", schedule);
      expect(other).not.toContain(schedule);
    });
  });

  describe("isolation", () => {
    it("does not expose internal state by reference", async () => {
      const first = await repo.getAppointment("demo-appt-1");
      expect(first).not.toBeNull();

      first!.reason = "mutated by caller";

      const again = await repo.getAppointment("demo-appt-1");
      expect(again!.reason).not.toBe("mutated by caller");
    });
  });

  describe("uploadIdentificationDocument", () => {
    it("returns an id and a url", async () => {
      const uploaded = await repo.uploadIdentificationDocument({
        name: "id-card.png",
        type: "image/png",
        bytes: new ArrayBuffer(8),
      });

      expect(uploaded.id).toBeTruthy();
      expect(uploaded.url).toMatch(/^(https?:)?\/?\//);
    });
  });
});

/* ------------------------------- helpers -------------------------------- */

function patientInput() {
  return {
    userId: "",
    name: "Contract Tester",
    email: "contract@example.com",
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

async function seedPatient(repo: DataRepository) {
  const user = await repo.createUser({
    name: "Appointment Owner",
    email: `owner-${Math.random().toString(36).slice(2)}@example.com`,
    phone: "+12025550777",
  });
  const patient = await repo.registerPatient({
    ...patientInput(),
    userId: user.id,
    email: user.email,
  });
  return { userId: user.id, patientId: patient.id };
}

function tomorrowAt(hour: number, minute: number) {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}
