import "server-only";

import {
  Client,
  Databases,
  Messaging,
  Storage,
  Users,
} from "node-appwrite";

import { requireAppwriteEnv } from "@/lib/env";

/**
 * Appwrite clients, built lazily.
 *
 * The original `lib/appwrite.config.ts` constructed the client at module scope
 * with `setEndpoint(ENDPOINT!)`, so merely importing the file threw when the
 * environment was unset — and it destructured the collection IDs without ever
 * exporting them, leaving five dead locals. Building on first use means demo
 * mode never touches this module at all.
 */

interface AppwriteClients {
  databases: Databases;
  storage: Storage;
  users: Users;
  messaging: Messaging;
  ids: {
    databaseId: string;
    patientCollectionId: string;
    appointmentCollectionId: string;
    bucketId: string;
    endpoint: string;
    projectId: string;
  };
}

let cached: AppwriteClients | null = null;

export function getAppwrite(): AppwriteClients {
  if (cached) return cached;

  const env = requireAppwriteEnv();

  const client = new Client()
    .setEndpoint(env.NEXT_PUBLIC_ENDPOINT)
    .setProject(env.PROJECT_ID)
    .setKey(env.API_KEY);

  cached = {
    databases: new Databases(client),
    storage: new Storage(client),
    users: new Users(client),
    messaging: new Messaging(client),
    ids: {
      databaseId: env.DATABASE_ID,
      patientCollectionId: env.PATIENT_COLLECTION_ID,
      appointmentCollectionId: env.APPOINTMENT_COLLECTION_ID,
      bucketId: env.NEXT_PUBLIC_BUCKET_ID,
      endpoint: env.NEXT_PUBLIC_ENDPOINT,
      projectId: env.PROJECT_ID,
    },
  };

  return cached;
}

/** Public view URL for a stored file. Appwrite has no helper for this. */
export function fileViewUrl(fileId: string): string {
  const { ids } = getAppwrite();
  return `${ids.endpoint}/storage/buckets/${ids.bucketId}/files/${fileId}/view?project=${ids.projectId}`;
}
