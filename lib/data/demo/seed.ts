import { Doctors, IdentificationTypes } from "@/constants";
import type {
  Appointment,
  AppointmentStatus,
  Gender,
  Patient,
  User,
} from "../types";

/**
 * Deterministic fixtures.
 *
 * Two properties matter here:
 *
 * 1. **Stable counts.** The admin StatCards must read the same numbers on every
 *    run, or the screenshots churn on every regeneration. So the status mix is
 *    hard-coded (8 scheduled / 6 pending / 3 cancelled), not random.
 *
 * 2. **Fresh-looking dates.** Schedules are offsets from *today*, not absolute
 *    timestamps, so a clone in six months still shows upcoming appointments
 *    rather than a wall of history.
 */

/** mulberry32 — small, fast, and identical across platforms and Node versions. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The user id the demo links and screenshot routes point at. */
export const DEMO_USER_ID = "demo-user";

interface PersonSpec {
  name: string;
  email: string;
  phone: string;
  gender: Gender;
  occupation: string;
  address: string;
  birthDate: string;
  insurance: string;
  allergies: string | null;
  medication: string | null;
}

const PEOPLE: readonly PersonSpec[] = [
  {
    name: "Jane Cooper",
    email: "jane.cooper@example.com",
    phone: "+12025550143",
    gender: "female",
    occupation: "Software Engineer",
    address: "418 Maple Street, Springfield, IL",
    birthDate: "1991-04-18",
    insurance: "Blue Shield",
    allergies: "Penicillin",
    medication: "Levothyroxine 50mcg daily",
  },
  {
    name: "Marcus Webb",
    email: "marcus.webb@example.com",
    phone: "+12025550178",
    gender: "male",
    occupation: "Civil Engineer",
    address: "77 Bridgeview Road, Portland, OR",
    birthDate: "1984-11-02",
    insurance: "Aetna",
    allergies: null,
    medication: "Atorvastatin 20mg nightly",
  },
  {
    name: "Priya Raman",
    email: "priya.raman@example.com",
    phone: "+12025550110",
    gender: "female",
    occupation: "Teacher",
    address: "9 Orchard Lane, Austin, TX",
    birthDate: "1996-07-25",
    insurance: "United Healthcare",
    allergies: "Shellfish, latex",
    medication: null,
  },
  {
    name: "Daniel Osei",
    email: "daniel.osei@example.com",
    phone: "+12025550194",
    gender: "male",
    occupation: "Chef",
    address: "1204 Harbour Way, Boston, MA",
    birthDate: "1979-01-30",
    insurance: "Cigna",
    allergies: null,
    medication: null,
  },
  {
    name: "Lena Fischer",
    email: "lena.fischer@example.com",
    phone: "+12025550166",
    gender: "female",
    occupation: "Architect",
    address: "23 Hillcrest Avenue, Denver, CO",
    birthDate: "1988-09-14",
    insurance: "Kaiser Permanente",
    allergies: "Ibuprofen",
    medication: "Sertraline 50mg daily",
  },
  {
    name: "Tomás Herrera",
    email: "tomas.herrera@example.com",
    phone: "+12025550122",
    gender: "male",
    occupation: "Logistics Manager",
    address: "560 Cedar Court, Phoenix, AZ",
    birthDate: "1993-03-08",
    insurance: "Humana",
    allergies: null,
    medication: "Metformin 500mg twice daily",
  },
  {
    name: "Aisha Bello",
    email: "aisha.bello@example.com",
    phone: "+12025550187",
    gender: "female",
    occupation: "Pharmacist",
    address: "88 Riverside Drive, Atlanta, GA",
    birthDate: "1990-12-21",
    insurance: "Blue Shield",
    allergies: "Sulfa drugs",
    medication: null,
  },
  {
    name: "Owen Whitfield",
    email: "owen.whitfield@example.com",
    phone: "+12025550135",
    gender: "male",
    occupation: "Accountant",
    address: "312 Elm Street, Seattle, WA",
    birthDate: "1975-06-05",
    insurance: "Aetna",
    allergies: null,
    medication: "Lisinopril 10mg daily",
  },
];

const REASONS = [
  "Annual physical examination",
  "Persistent lower back pain",
  "Follow-up on blood test results",
  "Recurring migraines, three per week",
  "Seasonal allergy review",
  "Post-operative check-up",
  "Routine diabetes management review",
  "Chest tightness during exercise",
  "Skin rash on forearms",
  "Sleep difficulty for the last month",
] as const;

const NOTES = [
  "Prefers a morning slot.",
  "Requires wheelchair access.",
  "Bringing previous imaging results.",
  "Needs an interpreter (Spanish).",
  null,
  null,
] as const;

const CANCELLATIONS = [
  "Patient requested a different doctor.",
  "Doctor unavailable — theatre list overran.",
  "Patient recovered; no longer needed.",
] as const;

/** Status mix, fixed so the dashboard numbers never move. */
const STATUS_PLAN: readonly AppointmentStatus[] = [
  "scheduled",
  "pending",
  "scheduled",
  "cancelled",
  "pending",
  "scheduled",
  "pending",
  "scheduled",
  "scheduled",
  "pending",
  "cancelled",
  "scheduled",
  "pending",
  "scheduled",
  "pending",
  "cancelled",
  "scheduled",
];

function startOfToday(now: Date) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

function atOffset(base: Date, dayOffset: number, hour: number, minute: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export interface SeedData {
  users: User[];
  patients: Patient[];
  appointments: Appointment[];
}

export function createSeedData(seed = 42, now = new Date()): SeedData {
  const rand = mulberry32(seed);
  const today = startOfToday(now);

  const users: User[] = [];
  const patients: Patient[] = [];

  PEOPLE.forEach((person, index) => {
    // The first person is the "you" of the demo, reachable at a stable URL.
    const userId = index === 0 ? DEMO_USER_ID : `demo-user-${index + 1}`;
    const doctor = Doctors[index % Doctors.length]!;

    users.push({
      id: userId,
      name: person.name,
      email: person.email,
      phone: person.phone,
    });

    patients.push({
      id: `demo-patient-${index + 1}`,
      userId,
      name: person.name,
      email: person.email,
      phone: person.phone,
      birthDate: new Date(`${person.birthDate}T00:00:00.000Z`).toISOString(),
      gender: person.gender,
      address: person.address,
      occupation: person.occupation,
      emergencyContactName: EMERGENCY_CONTACTS[index % EMERGENCY_CONTACTS.length]!,
      emergencyContactNumber: `+1202555${String(2000 + index).padStart(4, "0")}`,
      primaryPhysician: doctor.name,
      insuranceProvider: person.insurance,
      insurancePolicyNumber: `POL-${String(100_000 + Math.floor(rand() * 899_999))}`,
      allergies: person.allergies,
      currentMedication: person.medication,
      familyMedicalHistory:
        index % 3 === 0 ? "Type 2 diabetes (maternal grandmother)." : null,
      pastMedicalHistory:
        index % 4 === 0 ? "Appendectomy, 2012. No complications." : null,
      identificationType: IdentificationTypes[index % IdentificationTypes.length]!,
      identificationNumber: `ID-${String(10_000 + index * 137)}`,
      identificationDocumentId: null,
      identificationDocumentUrl: null,
      privacyConsent: true,
      treatmentConsent: true,
      disclosureConsent: true,
      createdAt: atOffset(today, -30 + index, 9, 0),
    });
  });

  const appointments: Appointment[] = STATUS_PLAN.map((status, i) => {
    const patient = patients[i % patients.length]!;
    const doctor = Doctors[(i * 3) % Doctors.length]!;

    // Cancelled and a slice of scheduled sit in the past; everything else is
    // upcoming. Slots land on the clinic's half-hour grid.
    const dayOffset =
      status === "cancelled" ? -(i % 5) - 1 : (i % 9) - (i % 3 === 0 ? 2 : 0);
    const hour = 9 + (i % 8);
    const minute = i % 2 === 0 ? 0 : 30;

    return {
      id: `demo-appt-${i + 1}`,
      userId: patient.userId,
      patient,
      primaryPhysician: doctor.name,
      schedule: atOffset(today, dayOffset, hour, minute),
      status,
      reason: REASONS[i % REASONS.length]!,
      note: NOTES[i % NOTES.length] ?? null,
      cancellationReason:
        status === "cancelled"
          ? CANCELLATIONS[i % CANCELLATIONS.length]!
          : null,
      createdAt: atOffset(today, -(i % 12) - 1, 8, 15),
    };
  });

  return { users, patients, appointments };
}

const EMERGENCY_CONTACTS = [
  "Michael Cooper",
  "Sandra Webb",
  "Arun Raman",
  "Grace Osei",
  "Peter Fischer",
  "Elena Herrera",
  "Ibrahim Bello",
  "Claire Whitfield",
] as const;
