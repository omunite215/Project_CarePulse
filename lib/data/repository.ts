import type {
  Appointment,
  AppointmentListResult,
  AppointmentQuery,
  CreateAppointmentInput,
  CreateUserInput,
  Patient,
  RegisterPatientInput,
  UpdateAppointmentInput,
  UploadedFile,
  User,
} from "./types";

/**
 * The single seam between the app and its backend.
 *
 * Two implementations satisfy it — Appwrite and seeded fixtures — and the same
 * contract test suite runs against both. Nothing above this layer knows or
 * cares which one is live.
 *
 * Methods either return a value or throw an `AppError`. `null` is reserved for
 * "legitimately absent" (no patient registered yet), never for "it failed" —
 * conflating the two is what let the original `createUser` swallow every error
 * and return `undefined`.
 */
export interface DataRepository {
  readonly kind: "appwrite" | "demo";

  /* ------------------------------- users ------------------------------- */

  /**
   * Creates a user, or returns the existing one when the email is already
   * taken. Idempotent by design: re-entering the same email on the onboarding
   * form should resume, not fail.
   */
  createUser(input: CreateUserInput): Promise<User>;
  getUser(userId: string): Promise<User | null>;

  /* ------------------------------ patients ----------------------------- */

  registerPatient(input: RegisterPatientInput): Promise<Patient>;
  getPatientByUserId(userId: string): Promise<Patient | null>;

  /* ---------------------------- appointments --------------------------- */

  createAppointment(input: CreateAppointmentInput): Promise<Appointment>;
  getAppointment(appointmentId: string): Promise<Appointment | null>;
  updateAppointment(
    appointmentId: string,
    changes: UpdateAppointmentInput,
  ): Promise<Appointment>;

  /** Admin list: filtered, sorted, paginated, with counts across all rows. */
  listAppointments(query?: AppointmentQuery): Promise<AppointmentListResult>;

  /** A single patient's own appointments, newest first. */
  listAppointmentsByUser(userId: string): Promise<Appointment[]>;

  /**
   * Already-taken slot start times (ISO) for a doctor on a given day.
   * Cancelled appointments do not occupy a slot.
   */
  getBookedSlots(physician: string, dayIso: string): Promise<string[]>;

  /* ------------------------------- storage ----------------------------- */

  uploadIdentificationDocument(file: {
    name: string;
    type: string;
    bytes: ArrayBuffer;
  }): Promise<UploadedFile>;
}
