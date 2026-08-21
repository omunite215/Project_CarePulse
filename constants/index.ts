import type { AppointmentStatus, Doctor, Gender } from "@/lib/data/types";

export const GenderOptions = ["male", "female", "other"] as const satisfies readonly Gender[];

/** Human labels for the radio group; the wire value stays lowercase. */
export const GenderLabels: Record<Gender, string> = {
  male: "Male",
  female: "Female",
  other: "Other",
};

export const IdentificationTypes = [
  "Birth Certificate",
  "Driver's License",
  "Medical Insurance Card/Policy",
  "Military ID Card",
  "National Identity Card",
  "Passport",
  "Resident Alien Card (Green Card)",
  "Social Security Card",
  "State ID Card",
  "Student ID Card",
  "Voter ID Card",
] as const;

/**
 * The doctor roster. These nine avatars have been sitting unused in
 * `public/assets/images/` since the project was scaffolded.
 */
export const Doctors: readonly Doctor[] = [
  { image: "/assets/images/dr-green.png", name: "John Green" },
  { image: "/assets/images/dr-cameron.png", name: "Leila Cameron" },
  { image: "/assets/images/dr-livingston.png", name: "David Livingston" },
  { image: "/assets/images/dr-peter.png", name: "Evan Peter" },
  { image: "/assets/images/dr-powell.png", name: "Jane Powell" },
  { image: "/assets/images/dr-remirez.png", name: "Alex Ramirez" },
  { image: "/assets/images/dr-lee.png", name: "Jasmine Lee" },
  { image: "/assets/images/dr-cruz.png", name: "Alyana Cruz" },
  { image: "/assets/images/dr-sharma.png", name: "Hardik Sharma" },
];

export function findDoctor(name: string): Doctor | undefined {
  return Doctors.find((doctor) => doctor.name === name);
}

export const StatusIcon: Record<AppointmentStatus, string> = {
  scheduled: "/assets/icons/check.svg",
  pending: "/assets/icons/pending.svg",
  cancelled: "/assets/icons/cancelled.svg",
};

export const StatusLabel: Record<AppointmentStatus, string> = {
  scheduled: "Scheduled",
  pending: "Pending",
  cancelled: "Cancelled",
};

export const StatCardBackground: Record<AppointmentStatus, string> = {
  scheduled: "bg-appointments",
  pending: "bg-pending",
  cancelled: "bg-cancelled",
};

/* -------------------------------------------------------------------------- */
/*                             Clinic scheduling                              */
/* -------------------------------------------------------------------------- */

/** Clinic opening hours, used to generate bookable slots. */
export const CLINIC_HOURS = {
  startHour: 9,
  endHour: 17,
  slotMinutes: 30,
} as const;

/** Appointments cannot be booked closer than this to now. */
export const MIN_BOOKING_LEAD_MINUTES = 60;

/* -------------------------------------------------------------------------- */
/*                              File upload rules                             */
/* -------------------------------------------------------------------------- */

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const ACCEPTED_UPLOAD_TYPES = {
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
  "application/pdf": [".pdf"],
} as const;
