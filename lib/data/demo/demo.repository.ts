import { APPOINTMENTS_PAGE_SIZE } from "@/constants";
import { AppError } from "@/lib/errors";
import { sleep } from "@/lib/utils";
import type { DataRepository } from "../repository";
import type {
  Appointment,
  AppointmentCounts,
  AppointmentListResult,
  AppointmentQuery,
  CreateAppointmentInput,
  CreateUserInput,
  Patient,
  RegisterPatientInput,
  UpdateAppointmentInput,
  UploadedFile,
  User,
} from "../types";
import { clone, getDemoStore, nextDemoId } from "./store";

/**
 * Fixture-backed repository.
 *
 * Satisfies the same contract as the Appwrite adapter, including the behaviours
 * that are easy to forget: `createUser` is idempotent on duplicate email,
 * cancelled appointments free their slot, and counts are computed across the
 * whole set rather than the current page.
 */
export class DemoRepository implements DataRepository {
  readonly kind = "demo" as const;

  constructor(
    private readonly seed = 42,
    private readonly latencyMs = 0,
  ) {}

  private get store() {
    return getDemoStore(this.seed);
  }

  /**
   * Demo-only read delay, so `loading.tsx` has time to paint.
   *
   * The `0` default on the constructor rather than a read of `DEMO_LATENCY_MS`
   * here: the repository contract suite constructs this class directly and
   * `pnpm test` never copies `.env` into `process.env`, so an env-reading
   * default would either sleep through that whole suite or need env plumbing
   * that exists nowhere else. `getRepository()` is the one caller that injects
   * a real value.
   *
   * Reads only. The writes stay instant so booking and the admin actions do
   * not feel sluggish, and so the slot re-check that closes the double-booking
   * race is not slowed on the path that needs it least.
   */
  private async withLatency<T>(produce: () => T): Promise<T> {
    if (this.latencyMs > 0) await sleep(this.latencyMs);
    return produce();
  }

  /* ------------------------------- users ------------------------------- */

  async createUser(input: CreateUserInput): Promise<User> {
    const store = this.store;
    const email = input.email.trim().toLowerCase();

    const existing = [...store.users.values()].find(
      (u) => u.email.toLowerCase() === email,
    );
    if (existing) return clone(existing);

    const user: User = {
      id: nextDemoId(store, "demo-user"),
      name: input.name.trim(),
      email: input.email.trim(),
      phone: input.phone.trim(),
    };
    store.users.set(user.id, user);
    return clone(user);
  }

  async getUser(userId: string): Promise<User | null> {
    return this.withLatency(() => {
      const user = this.store.users.get(userId);
      return user ? clone(user) : null;
    });
  }

  /* ------------------------------ patients ----------------------------- */

  async registerPatient(input: RegisterPatientInput): Promise<Patient> {
    const store = this.store;

    if (!store.users.has(input.userId)) {
      throw AppError.notFound("The user for this registration");
    }

    const already = [...store.patients.values()].find(
      (p) => p.userId === input.userId,
    );
    if (already) {
      throw new AppError(
        "CONFLICT",
        "This user has already completed registration.",
      );
    }

    const patient: Patient = {
      ...input,
      id: nextDemoId(store, "demo-patient"),
      createdAt: new Date().toISOString(),
    };
    store.patients.set(patient.id, patient);
    return clone(patient);
  }

  async getPatientByUserId(userId: string): Promise<Patient | null> {
    return this.withLatency(() => {
      const found = [...this.store.patients.values()].find(
        (p) => p.userId === userId,
      );
      return found ? clone(found) : null;
    });
  }

  /* ---------------------------- appointments --------------------------- */

  async createAppointment(
    input: CreateAppointmentInput,
  ): Promise<Appointment> {
    const store = this.store;
    const patient = store.patients.get(input.patientId);
    if (!patient) throw AppError.notFound("Patient");

    const appointment: Appointment = {
      id: nextDemoId(store, "demo-appt"),
      userId: input.userId,
      patient: clone(patient),
      primaryPhysician: input.primaryPhysician,
      schedule: input.schedule,
      status: input.status,
      reason: input.reason,
      note: input.note,
      cancellationReason: null,
      createdAt: new Date().toISOString(),
    };
    store.appointments.set(appointment.id, appointment);
    return clone(appointment);
  }

  async getAppointment(appointmentId: string): Promise<Appointment | null> {
    return this.withLatency(() => {
      const found = this.store.appointments.get(appointmentId);
      return found ? clone(found) : null;
    });
  }

  async updateAppointment(
    appointmentId: string,
    changes: UpdateAppointmentInput,
  ): Promise<Appointment> {
    const store = this.store;
    const current = store.appointments.get(appointmentId);
    if (!current) throw AppError.notFound("Appointment");

    const updated: Appointment = {
      ...current,
      ...stripUndefined(changes),
    };
    store.appointments.set(appointmentId, updated);
    return clone(updated);
  }

  async listAppointments(
    query: AppointmentQuery = {},
  ): Promise<AppointmentListResult> {
    return this.withLatency(() => {
      const all = [...this.store.appointments.values()];

      // Counts are always over the unfiltered set: the StatCards describe the
      // clinic, not the current search.
      const counts = countByStatus(all);

      const filtered = all.filter((a) => matches(a, query));
      const sorted = sortAppointments(filtered, query);

      const page = Math.max(1, query.page ?? 1);
      const pageSize = Math.min(
        100,
        Math.max(1, query.pageSize ?? APPOINTMENTS_PAGE_SIZE),
      );
      const start = (page - 1) * pageSize;

      return {
        documents: clone(sorted.slice(start, start + pageSize)),
        totalCount: sorted.length,
        counts,
      };
    });
  }

  async listAppointmentsByUser(userId: string): Promise<Appointment[]> {
    return this.withLatency(() => {
      const mine = [...this.store.appointments.values()]
        .filter((a) => a.userId === userId)
        .toSorted((a, b) => b.schedule.localeCompare(a.schedule));
      return clone(mine);
    });
  }

  async getBookedSlots(physician: string, dayIso: string): Promise<string[]> {
    return this.withLatency(() => {
      const day = dayIso.slice(0, 10);
      return [...this.store.appointments.values()]
        .filter(
          (a) =>
            a.primaryPhysician === physician &&
            a.status !== "cancelled" &&
            a.schedule.slice(0, 10) === day,
        )
        .map((a) => a.schedule);
    });
  }

  /* ------------------------------- storage ----------------------------- */

  async uploadIdentificationDocument(file: {
    name: string;
    type: string;
    bytes: ArrayBuffer;
  }): Promise<UploadedFile> {
    const store = this.store;
    const id = nextDemoId(store, "demo-file");
    store.files.set(id, file);
    // Served back by app/api/v1/files/[id] in demo mode.
    return { id, url: `/api/v1/files/${id}` };
  }
}

/* ------------------------------- helpers -------------------------------- */

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

export function countByStatus(list: Appointment[]): AppointmentCounts {
  return list.reduce<AppointmentCounts>(
    (acc, a) => {
      if (a.status === "scheduled") acc.scheduledCount += 1;
      else if (a.status === "pending") acc.pendingCount += 1;
      else if (a.status === "cancelled") acc.cancelledCount += 1;
      return acc;
    },
    { scheduledCount: 0, pendingCount: 0, cancelledCount: 0 },
  );
}

export function matches(a: Appointment, query: AppointmentQuery): boolean {
  if (query.status && query.status !== "all" && a.status !== query.status) {
    return false;
  }

  if (query.search) {
    const needle = query.search.trim().toLowerCase();
    if (needle) {
      const haystack = [
        a.patient.name,
        a.patient.email,
        a.primaryPhysician,
        a.reason,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
  }

  if (query.from && a.schedule < query.from) return false;
  if (query.to && a.schedule > query.to) return false;

  return true;
}

export function sortAppointments(
  list: Appointment[],
  query: AppointmentQuery,
): Appointment[] {
  const key = query.sort ?? "createdAt";
  const dir = query.direction ?? "desc";
  const sign = dir === "asc" ? 1 : -1;

  // `toSorted` rather than `[...list].sort()`: same non-mutating behaviour, one
  // fewer copy, and it cannot accidentally sort the caller's array in place.
  return list.toSorted((a, b) => {
    const compared =
      key === "patient"
        ? a.patient.name.localeCompare(b.patient.name)
        : key === "schedule"
          ? a.schedule.localeCompare(b.schedule)
          : a.createdAt.localeCompare(b.createdAt);
    return compared * sign;
  });
}
