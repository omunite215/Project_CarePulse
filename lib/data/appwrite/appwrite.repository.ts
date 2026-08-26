import "server-only";

import { ID, Query } from "node-appwrite";
import { InputFile } from "node-appwrite/file";

import { APPOINTMENTS_PAGE_SIZE } from "@/constants";
import { AppError } from "@/lib/errors";
import type { DataRepository } from "../repository";
import type {
  Appointment,
  AppointmentListResult,
  AppointmentQuery,
  AppointmentStatus,
  CreateAppointmentInput,
  CreateUserInput,
  Patient,
  RegisterPatientInput,
  UpdateAppointmentInput,
  UploadedFile,
  User,
} from "../types";
import { APPOINTMENT_STATUSES } from "../types";
import { fileViewUrl, getAppwrite } from "./client";
import {
  appointmentSearchText,
  patientToDocument,
  toAppointment,
  toPatient,
  toUser,
} from "./mappers";

/**
 * Appwrite-backed repository.
 *
 * Every method funnels failures through `AppError.from`, so an Appwrite 409
 * becomes a `CONFLICT` and a 404 becomes `NOT_FOUND` rather than being
 * swallowed. The original implementation caught only 409 and returned
 * `undefined` for everything else, which the caller then read as "no user".
 */
/**
 * Pulls the related patient document into an appointment read.
 *
 * Without it Appwrite 1.9 returns `patient` as a bare id string — see the note
 * in `toAppointment`. `"*"` is required alongside it, or the projection narrows
 * to the relationship alone and every scalar attribute comes back missing.
 */
const WITH_PATIENT = Query.select(["*", "patient.*"]);

export class AppwriteRepository implements DataRepository {
  readonly kind = "appwrite" as const;

  /* ------------------------------- users ------------------------------- */

  async createUser(input: CreateUserInput): Promise<User> {
    const { users } = getAppwrite();

    try {
      const created = await users.create({
        userId: ID.unique(),
        email: input.email,
        phone: input.phone,
        name: input.name,
      });
      return toUser(created);
    } catch (error) {
      const appError = AppError.from(error);

      // Appwrite answers 409 when the email is taken. Re-entering the same
      // email on the onboarding form should resume, not fail.
      if (appError.code === "CONFLICT") {
        const existing = await users.list({
          queries: [Query.equal("email", [input.email])],
        });
        const first = existing.users[0];
        if (first) return toUser(first);

        /*
         * Appwrite's 409 is "same id, email, *or* phone", and the Users service
         * enforces phone uniqueness across the whole project. Reaching here
         * means the email was free, so the collision is the phone number —
         * somebody else's account. Left as a bare CONFLICT this surfaced as a
         * submit that navigated nowhere and said nothing; a field error puts the
         * message where the problem is. Note the demo repository has no such
         * constraint: this is the backend's, not the app's.
         */
        const message =
          "That phone number is already registered to another account.";
        throw AppError.validation(message, { phone: message });
      }

      throw appError;
    }
  }

  async getUser(userId: string): Promise<User | null> {
    const { users } = getAppwrite();
    try {
      return toUser(await users.get({ userId }));
    } catch (error) {
      const appError = AppError.from(error);
      if (appError.code === "NOT_FOUND") return null;
      throw appError;
    }
  }

  /* ------------------------------ patients ----------------------------- */

  async registerPatient(input: RegisterPatientInput): Promise<Patient> {
    const { databases, ids } = getAppwrite();

    /*
     * `userId` is a plain string attribute, so Appwrite enforces neither of
     * these itself: it would happily store a patient for an id that belongs to
     * nobody, and a second patient for a user who already has one — after which
     * `getPatientByUserId` silently returns whichever row it orders first. The
     * demo repository rejects both, and the contract suite caught the
     * divergence the moment it started running against a live project.
     */
    if (!(await this.getUser(input.userId))) {
      throw AppError.notFound("The user for this registration");
    }
    if (await this.getPatientByUserId(input.userId)) {
      throw new AppError(
        "CONFLICT",
        "This user has already completed registration.",
      );
    }

    try {
      const doc = await databases.createDocument({
        databaseId: ids.databaseId,
        collectionId: ids.patientCollectionId,
        documentId: ID.unique(),
        data: patientToDocument(input),
      });
      return toPatient(doc);
    } catch (error) {
      throw AppError.from(error);
    }
  }

  /**
   * By document id rather than user id. Not on `DataRepository` — nothing above
   * this layer needs it; `createAppointment` does, to denormalise the patient's
   * name and email onto the appointment.
   */
  private async getPatientById(patientId: string): Promise<Patient | null> {
    const { databases, ids } = getAppwrite();
    try {
      const doc = await databases.getDocument({
        databaseId: ids.databaseId,
        collectionId: ids.patientCollectionId,
        documentId: patientId,
      });
      return toPatient(doc);
    } catch (error) {
      const appError = AppError.from(error);
      if (appError.code === "NOT_FOUND") return null;
      throw appError;
    }
  }

  async getPatientByUserId(userId: string): Promise<Patient | null> {
    const { databases, ids } = getAppwrite();
    try {
      const found = await databases.listDocuments({
        databaseId: ids.databaseId,
        collectionId: ids.patientCollectionId,
        queries: [Query.equal("userId", [userId]), Query.limit(1)],
      });
      const first = found.documents[0];
      return first ? toPatient(first) : null;
    } catch (error) {
      throw AppError.from(error);
    }
  }

  /* ---------------------------- appointments --------------------------- */

  async createAppointment(
    input: CreateAppointmentInput,
  ): Promise<Appointment> {
    const { databases, ids } = getAppwrite();

    // `CreateAppointmentInput` carries only `patientId`, but the denormalised
    // search fields need the patient's name and email. Reading the patient here
    // keeps that cost inside the adapter instead of widening the domain input
    // for one backend's indexing limitation.
    const patient = await this.getPatientById(input.patientId);
    if (!patient) throw AppError.notFound("Patient");

    try {
      const doc = await databases.createDocument({
        databaseId: ids.databaseId,
        collectionId: ids.appointmentCollectionId,
        documentId: ID.unique(),
        data: {
          userId: input.userId,
          // Relationship attribute: written as an id, read back expanded.
          patient: input.patientId,
          primaryPhysician: input.primaryPhysician,
          schedule: input.schedule,
          status: input.status,
          reason: input.reason,
          note: input.note ?? "",
          cancellationReason: null,
          patientName: patient.name,
          searchText: appointmentSearchText({
            patientName: patient.name,
            patientEmail: patient.email,
            primaryPhysician: input.primaryPhysician,
            reason: input.reason,
          }),
        },
      });
      return toAppointment(doc);
    } catch (error) {
      throw AppError.from(error);
    }
  }

  async getAppointment(appointmentId: string): Promise<Appointment | null> {
    const { databases, ids } = getAppwrite();
    try {
      const doc = await databases.getDocument({
        databaseId: ids.databaseId,
        collectionId: ids.appointmentCollectionId,
        documentId: appointmentId,
        queries: [WITH_PATIENT],
      });
      return toAppointment(doc);
    } catch (error) {
      const appError = AppError.from(error);
      if (appError.code === "NOT_FOUND") return null;
      throw appError;
    }
  }

  async updateAppointment(
    appointmentId: string,
    changes: UpdateAppointmentInput,
  ): Promise<Appointment> {
    const { databases, ids } = getAppwrite();

    // A reschedule changes the doctor, which is part of `searchText` — leaving
    // it stale would make the admin search quietly wrong for exactly the rows
    // that were most recently touched. Only re-read when a contributing field
    // is actually in the changeset; a plain status flip skips the round trip.
    const data: Record<string, unknown> = { ...changes };
    if (changes.primaryPhysician !== undefined || changes.reason !== undefined) {
      const existing = await this.getAppointment(appointmentId);
      if (!existing) throw AppError.notFound("Appointment");

      data.searchText = appointmentSearchText({
        patientName: existing.patient.name,
        patientEmail: existing.patient.email,
        primaryPhysician: changes.primaryPhysician ?? existing.primaryPhysician,
        reason: changes.reason ?? existing.reason,
      });
    }

    try {
      const doc = await databases.updateDocument({
        databaseId: ids.databaseId,
        collectionId: ids.appointmentCollectionId,
        documentId: appointmentId,
        data,
      });
      return toAppointment(doc);
    } catch (error) {
      throw AppError.from(error);
    }
  }

  async listAppointments(
    query: AppointmentQuery = {},
  ): Promise<AppointmentListResult> {
    const { databases, ids } = getAppwrite();
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(
      100,
      Math.max(1, query.pageSize ?? APPOINTMENTS_PAGE_SIZE),
    );

    try {
      const queries: string[] = [WITH_PATIENT];

      if (query.status && query.status !== "all") {
        queries.push(Query.equal("status", [query.status]));
      }
      // Searches the denormalised blob, not `primaryPhysician`: the contract is
      // a match against patient name, patient email, doctor and reason, and
      // Appwrite cannot reach the first two through the `patient` relationship.
      // Trimmed for parity with the demo matcher, which ignores a blank needle.
      const search = query.search?.trim();
      if (search) queries.push(Query.search("searchText", search));

      if (query.from) queries.push(Query.greaterThanEqual("schedule", query.from));
      if (query.to) queries.push(Query.lessThanEqual("schedule", query.to));

      // `patient` sorts on the denormalised copy of the name for the same
      // reason: Appwrite can order by a plain attribute but not across a
      // relationship. Anything else falls back to creation date, matching the
      // demo repository's default.
      const sortField =
        query.sort === "schedule"
          ? "schedule"
          : query.sort === "patient"
            ? "patientName"
            : "$createdAt";

      queries.push(
        query.direction === "asc"
          ? Query.orderAsc(sortField)
          : Query.orderDesc(sortField),
      );
      queries.push(Query.limit(pageSize));
      queries.push(Query.offset((page - 1) * pageSize));

      /*
       * Counts describe the whole clinic, not the current page, so they need
       * their own read — but one per status, asking for a single document and
       * reading the server-computed `total`. The previous implementation pulled
       * 1000 documents and tallied them in JS, which is Appwrite's per-request
       * ceiling: past 1000 appointments the StatCards silently under-reported
       * forever, with no error and no log. `idx_status` keeps these three as
       * index lookups rather than collection scans.
       */
      const [pageResult, statusTotals] = await Promise.all([
        databases.listDocuments({
          databaseId: ids.databaseId,
          collectionId: ids.appointmentCollectionId,
          queries,
        }),
        Promise.all(
          APPOINTMENT_STATUSES.map(async (status) => {
            const { total } = await databases.listDocuments({
              databaseId: ids.databaseId,
              collectionId: ids.appointmentCollectionId,
              queries: [Query.equal("status", [status]), Query.limit(1)],
            });
            return [status, total] as const;
          }),
        ),
      ]);

      const totals = Object.fromEntries(statusTotals) as Record<
        AppointmentStatus,
        number
      >;

      return {
        documents: pageResult.documents.map(toAppointment),
        totalCount: pageResult.total,
        counts: {
          scheduledCount: totals.scheduled,
          pendingCount: totals.pending,
          cancelledCount: totals.cancelled,
        },
      };
    } catch (error) {
      throw AppError.from(error);
    }
  }

  async listAppointmentsByUser(userId: string): Promise<Appointment[]> {
    const { databases, ids } = getAppwrite();
    try {
      const result = await databases.listDocuments({
        databaseId: ids.databaseId,
        collectionId: ids.appointmentCollectionId,
        queries: [
          WITH_PATIENT,
          Query.equal("userId", [userId]),
          Query.orderDesc("schedule"),
          Query.limit(100),
        ],
      });
      return result.documents.map(toAppointment);
    } catch (error) {
      throw AppError.from(error);
    }
  }

  async getBookedSlots(physician: string, dayIso: string): Promise<string[]> {
    const { databases, ids } = getAppwrite();
    const day = dayIso.slice(0, 10);

    try {
      const result = await databases.listDocuments({
        databaseId: ids.databaseId,
        collectionId: ids.appointmentCollectionId,
        queries: [
          Query.equal("primaryPhysician", [physician]),
          Query.greaterThanEqual("schedule", `${day}T00:00:00.000Z`),
          Query.lessThanEqual("schedule", `${day}T23:59:59.999Z`),
          Query.notEqual("status", ["cancelled"]),
          Query.limit(100),
        ],
      });
      return result.documents.map((doc) => toAppointment(doc).schedule);
    } catch (error) {
      throw AppError.from(error);
    }
  }

  /* ------------------------------- storage ----------------------------- */

  async uploadIdentificationDocument(file: {
    name: string;
    type: string;
    bytes: ArrayBuffer;
  }): Promise<UploadedFile> {
    const { storage, ids } = getAppwrite();
    try {
      const created = await storage.createFile({
        bucketId: ids.bucketId,
        fileId: ID.unique(),
        file: InputFile.fromBuffer(file.bytes, file.name),
      });
      return { id: created.$id, url: fileViewUrl(created.$id) };
    } catch (error) {
      throw AppError.from(error);
    }
  }
}
