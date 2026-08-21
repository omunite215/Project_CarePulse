import type { Models } from "node-appwrite";

import type {
  Appointment,
  AppointmentStatus,
  Gender,
  Patient,
  User,
} from "../types";
import { APPOINTMENT_STATUSES, GENDERS } from "../types";

/**
 * Appwrite documents → domain models.
 *
 * This is the only place that knows about `$id` / `$createdAt`. Keeping the
 * envelope here is what lets the demo repository exist without inventing fake
 * Appwrite metadata, and stops `Models.Document` leaking into components.
 */

type Doc = Models.Document & Record<string, unknown>;

export function toUser(doc: Models.User<Models.Preferences>): User {
  return {
    id: doc.$id,
    name: doc.name,
    email: doc.email,
    phone: doc.phone,
  };
}

export function toPatient(doc: Doc): Patient {
  return {
    id: doc.$id,
    userId: str(doc.userId),
    name: str(doc.name),
    email: str(doc.email),
    phone: str(doc.phone),
    birthDate: iso(doc.birthDate),
    gender: gender(doc.gender),
    address: str(doc.address),
    occupation: str(doc.occupation),
    emergencyContactName: str(doc.emergencyContactName),
    emergencyContactNumber: str(doc.emergencyContactNumber),
    primaryPhysician: str(doc.primaryPhysician),
    insuranceProvider: str(doc.insuranceProvider),
    insurancePolicyNumber: str(doc.insurancePolicyNumber),
    allergies: nullableStr(doc.allergies),
    currentMedication: nullableStr(doc.currentMedication),
    familyMedicalHistory: nullableStr(doc.familyMedicalHistory),
    pastMedicalHistory: nullableStr(doc.pastMedicalHistory),
    identificationType: nullableStr(doc.identificationType),
    identificationNumber: nullableStr(doc.identificationNumber),
    identificationDocumentId: nullableStr(doc.identificationDocumentId),
    identificationDocumentUrl: nullableStr(doc.identificationDocumentUrl),
    privacyConsent: Boolean(doc.privacyConsent),
    treatmentConsent: Boolean(doc.treatmentConsent),
    disclosureConsent: Boolean(doc.disclosureConsent),
    createdAt: doc.$createdAt,
  };
}

export function toAppointment(doc: Doc): Appointment {
  // `patient` is a relationship attribute, so Appwrite expands it into a full
  // nested document on read but expects a bare id string on write.
  const patientDoc = doc.patient as Doc | null;

  return {
    id: doc.$id,
    userId: str(doc.userId),
    patient: patientDoc
      ? toPatient(patientDoc)
      : placeholderPatient(str(doc.userId)),
    primaryPhysician: str(doc.primaryPhysician),
    schedule: iso(doc.schedule),
    status: status(doc.status),
    reason: str(doc.reason),
    note: nullableStr(doc.note),
    cancellationReason: nullableStr(doc.cancellationReason),
    createdAt: doc.$createdAt,
  };
}

/** Domain → Appwrite attribute payload for the patient collection. */
export function patientToDocument(
  patient: Omit<Patient, "id" | "createdAt">,
): Record<string, unknown> {
  return { ...patient };
}

/* ------------------------------- coercion -------------------------------- */

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableStr(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function iso(value: unknown): string {
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return new Date(0).toISOString();
}

function gender(value: unknown): Gender {
  const lowered = String(value).toLowerCase();
  return (GENDERS as readonly string[]).includes(lowered)
    ? (lowered as Gender)
    : "other";
}

function status(value: unknown): AppointmentStatus {
  const lowered = String(value).toLowerCase();
  return (APPOINTMENT_STATUSES as readonly string[]).includes(lowered)
    ? (lowered as AppointmentStatus)
    : "pending";
}

/**
 * A relationship that failed to expand should not crash the admin table. Render
 * a clearly-degraded row instead so the operator can still see and act on it.
 */
function placeholderPatient(userId: string): Patient {
  return {
    id: "",
    userId,
    name: "Unknown patient",
    email: "",
    phone: "",
    birthDate: new Date(0).toISOString(),
    gender: "other",
    address: "",
    occupation: "",
    emergencyContactName: "",
    emergencyContactNumber: "",
    primaryPhysician: "",
    insuranceProvider: "",
    insurancePolicyNumber: "",
    allergies: null,
    currentMedication: null,
    familyMedicalHistory: null,
    pastMedicalHistory: null,
    identificationType: null,
    identificationNumber: null,
    identificationDocumentId: null,
    identificationDocumentUrl: null,
    privacyConsent: false,
    treatmentConsent: false,
    disclosureConsent: false,
    createdAt: new Date(0).toISOString(),
  };
}
