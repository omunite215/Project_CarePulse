"use server";

import { revalidatePath } from "next/cache";

import { getRepository } from "@/lib/data";
import type { Patient, User } from "@/lib/data/types";
import { AppError } from "@/lib/errors";
import { MAX_UPLOAD_BYTES } from "@/constants";
import { PatientFormValidation } from "@/lib/validation/patient";
import { UserFormValidation } from "@/lib/validation/user";
import { type ActionResult, parseOrThrow, run } from "./result";

/**
 * Onboarding: create (or resume) a user from name/email/phone.
 *
 * The original version assigned `const newUser = await users.create(...)` and
 * never returned it, so the happy path resolved to `undefined` and the caller's
 * `if (user) router.push(...)` never fired. Only the duplicate-email branch
 * returned anything.
 */
export async function createUser(
  input: unknown,
): Promise<ActionResult<User>> {
  return run(async () => {
    const values = parseOrThrow(UserFormValidation, input);
    const repo = await getRepository();
    return repo.createUser(values);
  });
}

export async function getUser(
  userId: string,
): Promise<ActionResult<User | null>> {
  return run(async () => {
    const repo = await getRepository();
    return repo.getUser(userId);
  });
}

export async function getPatient(
  userId: string,
): Promise<ActionResult<Patient | null>> {
  return run(async () => {
    const repo = await getRepository();
    return repo.getPatientByUserId(userId);
  });
}

/**
 * Completes registration.
 *
 * Values and the file are separate arguments rather than a hand-packed FormData
 * blob: Next's Server Action serialiser handles `Date` and `File` natively, so
 * one Zod schema can validate the same shape on both sides instead of the client
 * JSON-stringifying and the server re-parsing 22 entries by hand.
 */
export async function registerPatient(
  userId: string,
  values: unknown,
  file: File | null,
): Promise<ActionResult<Patient>> {
  return run(async () => {
    if (!userId) throw AppError.validation("Missing user reference.");

    // The File is validated below rather than by Zod, which cannot meaningfully
    // introspect it.
    const parsed = parseOrThrow(
      PatientFormValidation.omit({ identificationDocument: true }),
      values,
    );

    const repo = await getRepository();

    const user = await repo.getUser(userId);
    if (!user) throw AppError.notFound("User");

    let documentId: string | null = null;
    let documentUrl: string | null = null;

    if (file && file.size > 0) {
      if (file.size > MAX_UPLOAD_BYTES) {
        throw AppError.validation("That file is too large.", {
          identificationDocument: "File must be 5 MB or smaller.",
        });
      }

      const uploaded = await repo.uploadIdentificationDocument({
        name: file.name,
        type: file.type,
        bytes: await file.arrayBuffer(),
      });
      documentId = uploaded.id;
      documentUrl = uploaded.url;
    }

    const patient = await repo.registerPatient({
      userId,
      name: parsed.name,
      email: parsed.email,
      phone: parsed.phone,
      birthDate: parsed.birthDate.toISOString(),
      gender: parsed.gender,
      address: parsed.address,
      occupation: parsed.occupation,
      emergencyContactName: parsed.emergencyContactName,
      emergencyContactNumber: parsed.emergencyContactNumber,
      primaryPhysician: parsed.primaryPhysician,
      insuranceProvider: parsed.insuranceProvider,
      insurancePolicyNumber: parsed.insurancePolicyNumber,
      allergies: parsed.allergies || null,
      currentMedication: parsed.currentMedication || null,
      familyMedicalHistory: parsed.familyMedicalHistory || null,
      pastMedicalHistory: parsed.pastMedicalHistory || null,
      identificationType: parsed.identificationType || null,
      identificationNumber: parsed.identificationNumber || null,
      identificationDocumentId: documentId,
      identificationDocumentUrl: documentUrl,
      privacyConsent: parsed.privacyConsent,
      treatmentConsent: parsed.treatmentConsent,
      disclosureConsent: parsed.disclosureConsent,
    });

    revalidatePath(`/patients/${userId}/register`);
    return patient;
  });
}
