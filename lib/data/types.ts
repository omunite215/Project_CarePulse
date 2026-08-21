/**
 * Domain models.
 *
 * Deliberately NOT Appwrite models. The original project leaked
 * `Models.Document` (`$id`, `$createdAt`, …) all the way into components, which
 * is what made a demo/fixture mode impossible without faking Appwrite's
 * document envelope. Everything above `lib/data/*` speaks these types; the
 * adapters map to and from them.
 *
 * Dates are ISO-8601 strings, not `Date`. They cross an RSC boundary and a JSON
 * route-handler boundary, and a string survives both unchanged.
 */

export type Gender = "male" | "female" | "other";

export const GENDERS = ["male", "female", "other"] as const satisfies readonly Gender[];

export type AppointmentStatus = "pending" | "scheduled" | "cancelled";

export const APPOINTMENT_STATUSES = [
  "pending",
  "scheduled",
  "cancelled",
] as const satisfies readonly AppointmentStatus[];

/** An authenticated identity. Maps to Appwrite's Users service. */
export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
}

/** A registered patient record. Maps to the `patient` collection. */
export interface Patient {
  id: string;
  userId: string;

  name: string;
  email: string;
  phone: string;
  birthDate: string;
  gender: Gender;
  address: string;
  occupation: string;
  emergencyContactName: string;
  emergencyContactNumber: string;

  primaryPhysician: string;
  insuranceProvider: string;
  insurancePolicyNumber: string;
  allergies: string | null;
  currentMedication: string | null;
  familyMedicalHistory: string | null;
  pastMedicalHistory: string | null;

  identificationType: string | null;
  identificationNumber: string | null;
  identificationDocumentId: string | null;
  identificationDocumentUrl: string | null;

  privacyConsent: boolean;
  treatmentConsent: boolean;
  disclosureConsent: boolean;

  createdAt: string;
}

/** A booked appointment. Maps to the `appointment` collection. */
export interface Appointment {
  id: string;
  userId: string;
  /** Resolved patient. Appwrite models this as a relationship attribute. */
  patient: Patient;
  primaryPhysician: string;
  schedule: string;
  status: AppointmentStatus;
  reason: string;
  note: string | null;
  cancellationReason: string | null;
  createdAt: string;
}

/** Doctors are a fixed roster in `constants/`, not a collection. */
export interface Doctor {
  name: string;
  image: string;
}

export interface AppointmentCounts {
  scheduledCount: number;
  pendingCount: number;
  cancelledCount: number;
}

export interface AppointmentListResult {
  documents: Appointment[];
  totalCount: number;
  counts: AppointmentCounts;
}

/* -------------------------------------------------------------------------- */
/*                              Query parameters                              */
/* -------------------------------------------------------------------------- */

export interface AppointmentQuery {
  /** Free-text match against patient name, email and doctor. */
  search?: string;
  status?: AppointmentStatus | "all";
  /** Inclusive ISO date bounds on `schedule`. */
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  sort?: "schedule" | "createdAt" | "patient";
  direction?: "asc" | "desc";
}

export interface CreateUserInput {
  name: string;
  email: string;
  phone: string;
}

export type RegisterPatientInput = Omit<Patient, "id" | "createdAt">;

export interface CreateAppointmentInput {
  userId: string;
  patientId: string;
  primaryPhysician: string;
  schedule: string;
  reason: string;
  note: string | null;
  status: AppointmentStatus;
}

export interface UpdateAppointmentInput {
  primaryPhysician?: string;
  schedule?: string;
  status?: AppointmentStatus;
  reason?: string;
  note?: string | null;
  cancellationReason?: string | null;
}

/** A single bookable slot for the availability picker. */
export interface TimeSlot {
  /** ISO timestamp of the slot start. */
  value: string;
  /** e.g. "9:00 AM" */
  label: string;
  available: boolean;
}

export interface UploadedFile {
  id: string;
  url: string;
}
