import "server-only";

import { ID, Query } from "node-appwrite";
import { InputFile } from "node-appwrite/file";

import { AppError } from "@/lib/errors";
import type { DataRepository } from "../repository";
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
} from "../types";
import { countByStatus } from "../demo/demo.repository";
import { fileViewUrl, getAppwrite } from "./client";
import { patientToDocument, toAppointment, toPatient, toUser } from "./mappers";

/**
 * Appwrite-backed repository.
 *
 * Every method funnels failures through `AppError.from`, so an Appwrite 409
 * becomes a `CONFLICT` and a 404 becomes `NOT_FOUND` rather than being
 * swallowed. The original implementation caught only 409 and returned
 * `undefined` for everything else, which the caller then read as "no user".
 */
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
    try {
      const doc = await databases.updateDocument({
        databaseId: ids.databaseId,
        collectionId: ids.appointmentCollectionId,
        documentId: appointmentId,
        data: changes as Record<string, unknown>,
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
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 10));

    try {
      const queries: string[] = [];

      if (query.status && query.status !== "all") {
        queries.push(Query.equal("status", [query.status]));
      }
      if (query.search) {
        queries.push(Query.search("primaryPhysician", query.search));
      }
      if (query.from) queries.push(Query.greaterThanEqual("schedule", query.from));
      if (query.to) queries.push(Query.lessThanEqual("schedule", query.to));

      const sortField = query.sort === "schedule" ? "schedule" : "$createdAt";
      queries.push(
        query.direction === "asc"
          ? Query.orderAsc(sortField)
          : Query.orderDesc(sortField),
      );
      queries.push(Query.limit(pageSize));
      queries.push(Query.offset((page - 1) * pageSize));

      const [pageResult, countsResult] = await Promise.all([
        databases.listDocuments({
          databaseId: ids.databaseId,
          collectionId: ids.appointmentCollectionId,
          queries,
        }),
        // Counts describe the whole clinic, not the current page, so they need
        // their own unfiltered read.
        databases.listDocuments({
          databaseId: ids.databaseId,
          collectionId: ids.appointmentCollectionId,
          queries: [Query.limit(1000)],
        }),
      ]);

      return {
        documents: pageResult.documents.map(toAppointment),
        totalCount: pageResult.total,
        counts: countByStatus(countsResult.documents.map(toAppointment)),
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
