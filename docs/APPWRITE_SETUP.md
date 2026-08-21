# Appwrite provisioning guide

Everything in this document is derived from the code that actually talks to Appwrite:
`lib/data/types.ts`, `lib/data/appwrite/mappers.ts`, `lib/data/appwrite/appwrite.repository.ts`,
`lib/data/appwrite/client.ts`, `lib/data/repository.ts`, `lib/env.ts`, `.env.example`,
`lib/services/notifications.ts`, `lib/validation/*.ts` and `constants/index.ts`. Where the code
does not settle a question (a size, a scope, a setting), that is called out in
[§9 Open questions](#9-open-questions) instead of guessed.

The installed SDK is `node-appwrite@28.0.0` (`package.json:37`), which the project's own
`.env.example:18-19` says targets **Appwrite Server 1.9.x** — older servers (1.5.x and earlier)
will 404 on the endpoints this adapter calls.

**Important caveat before you start:** `node-appwrite@28`'s entire `Databases` service —
`listDocuments`, `createDocument`, `updateDocument`, `createCollection`, every attribute/index
method — is marked `@deprecated This API has been deprecated since 1.8.0. Please use
TablesDB.* instead` in the shipped type definitions
(`node_modules/node-appwrite/dist/services/databases.d.ts:1902`, and identically for every other
`Databases` method). `lib/data/appwrite/appwrite.repository.ts` and `lib/data/appwrite/client.ts`
exclusively use this deprecated `Databases`/`Storage`/`Users` surface — there is no `TablesDB`
import anywhere in the codebase. This document therefore provisions classic **Collections**,
**Documents**, **Attributes** and **Indexes**, because that is what the shipped adapter calls,
not the newer Tables/Columns/Rows model. See §9 for the forward-compatibility risk this implies.

## 1. What to create, in order

1. **Project.** Create (or open) an Appwrite project. Copy its Project ID into `PROJECT_ID`.
2. **API key.** Create a server API key with the scopes in [§5](#5-api-key-scopes). Copy the
   secret into `API_KEY`. Never commit it.
3. **Database.** Create one database. Its ID goes into `DATABASE_ID`
   (`lib/env.ts:24`, read at `lib/data/appwrite/client.ts:56`). This document uses `carepulse`
   as an example ID — the code does not require that name, since `DATABASE_ID` has no default
   in `lib/env.ts` (`AppwriteEnvSchema`, `lib/env.ts:20-28`).
4. **`patient` collection.** Create a collection in that database. Its ID goes into
   `PATIENT_COLLECTION_ID` (`lib/env.ts:25`, `client.ts:57`). Example ID: `patient`.
   - Leave collection-level permissions empty and **Document Security off**. Every read/write to
     this collection happens through `getAppwrite()`'s API-key client (`client.ts:45-48`) —
     there is exactly one `new Client()` call in the codebase, confirmed by repo-wide search —
     and Appwrite API keys bypass collection/document permission checks entirely. Permissions on
     this collection have no effect on the running app.
   - Add every attribute in [§2.1](#21-patient-collection).
   - Add the index in [§3](#3-indexes).
5. **`appointment` collection.** Same database, same permission reasoning (empty permissions,
   Document Security off). Its ID goes into `APPOINTMENT_COLLECTION_ID` (`lib/env.ts:26`,
   `client.ts:58`). Example ID: `appointment`.
   - Add every attribute in [§2.2](#22-appointment-collection), **including the `patient`
     relationship attribute** — create it after the `patient` collection exists.
   - Add the five indexes in [§3](#3-indexes).
6. **Storage bucket.** Create one bucket per [§4](#4-storage-bucket). Its ID goes into
   `NEXT_PUBLIC_BUCKET_ID` (`lib/env.ts:27`, `client.ts:59`). Example ID:
   `identification-documents`. **Set bucket permissions and File Security exactly as described
   in §4** — the app never sets per-file permissions, so getting this wrong makes every uploaded
   document permanently unviewable.
7. **Messaging provider.** In the Appwrite console, add an SMS provider (Twilio, per
   `README.md:59` and `.env.example:12-19`) under Messaging → Providers. This is entirely
   console-side configuration; there is no Twilio SDK or Twilio env var in this codebase — the
   app only calls `messaging.createSms({ messageId: ID.unique(), content, users: [userId] })`
   (`lib/services/notifications.ts:59-63`), which routes through whatever provider is active.
   No topic or subscriber setup is needed — the app messages a specific user ID directly.
8. **Endpoint.** Copy the project's API endpoint (e.g. `https://cloud.appwrite.io/v1` for
   Appwrite Cloud, or your self-hosted URL) into `NEXT_PUBLIC_ENDPOINT`.
9. **Paste into `.env.local`.** Fill in all seven Appwrite variables from
   [§8](#8-environment-variables). `lib/env.ts:92-110` treats a partial set as a configuration
   error at boot — set all seven or none.

## 2. Attribute tables

Rules applied throughout: an attribute is **required** only if every code path that creates the
document always supplies a real value **and** the mapper reads it with no null/fallback handling.
If the mapper calls `nullableStr()` (`mappers.ts:96-98`) or the domain type is `T | null`, it is
marked **not required**, even if, in practice, the current write paths happen to always pass a
value.

### 2.1 Patient collection

Source of truth: `Patient` interface (`lib/data/types.ts:35-67`), `toPatient` /
`patientToDocument` (`mappers.ts:31-60, 84-88`).

| Attribute key | Appwrite type | Size/params | Required | Default | Array? |
|---|---|---|---|---|---|
| `userId` | string | 36 | Yes | — | No |
| `name` | string | 50 | Yes | — | No |
| `email` | string | 320 (open question — see §9) | Yes | — | No |
| `phone` | string | 20 | Yes | — | No |
| `birthDate` | datetime | — | Yes | — | No |
| `gender` | string, `format: enum` | elements `["male","female","other"]` | Yes | — | No |
| `address` | string | 500 | Yes | — | No |
| `occupation` | string | 500 | Yes | — | No |
| `emergencyContactName` | string | 50 | Yes | — | No |
| `emergencyContactNumber` | string | 20 | Yes | — | No |
| `primaryPhysician` | string | 100 (open question — see §9) | Yes | — | No |
| `insuranceProvider` | string | 50 | Yes | — | No |
| `insurancePolicyNumber` | string | 50 | Yes | — | No |
| `allergies` | string | 500 | No | null | No |
| `currentMedication` | string | 500 | No | null | No |
| `familyMedicalHistory` | string | 500 | No | null | No |
| `pastMedicalHistory` | string | 500 | No | null | No |
| `identificationType` | string | 100 (open question — see §9) | No | null | No |
| `identificationNumber` | string | 50 | No | null | No |
| `identificationDocumentId` | string | 36 (open question — see §9) | No | null | No |
| `identificationDocumentUrl` | string | 2048 (open question — see §9) | No | null | No |
| `privacyConsent` | boolean | — | Yes | — | No |
| `treatmentConsent` | boolean | — | Yes | — | No |
| `disclosureConsent` | boolean | — | Yes | — | No |

`id` and `createdAt` on the domain `Patient` type map to Appwrite's own `$id`/`$createdAt`
system fields (`mappers.ts:33,58`) — do not create them as custom attributes.

Per-attribute justification:

- **`userId`** — `Patient.userId: string` (`types.ts:37`), read with `str()` (no fallback beyond
  `""`, `mappers.ts:34`), written by `patientToDocument` spreading `RegisterPatientInput`
  (`mappers.ts:84-88`), which requires it (`types.ts:125`). Size 36 because it holds an Appwrite
  Users ID, and Appwrite's own generated IDs (`ID.unique()`, used at `appwrite.repository.ts:42`
  for the matching `users.create` call) are capped at 36 characters.
- **`name`**, **`emergencyContactName`** — `personNameSchema`, `.max(50)`
  (`lib/validation/primitives.ts:12-16`), used at `patient.ts:20,43`.
- **`phone`**, **`emergencyContactNumber`** — `phoneSchema` regexes to `^\+\d{10,15}$`
  (`primitives.ts:4-10`), i.e. at most 16 characters; 20 leaves margin. Used at `patient.ts:22,44`.
- **`address`**, **`occupation`** — explicit `.max(500)` (`patient.ts:33-37, 38-42`).
- **`insuranceProvider`**, **`insurancePolicyNumber`** — explicit `.max(50)`
  (`patient.ts:48-52, 53-57`).
- **`allergies`**, **`currentMedication`**, **`familyMedicalHistory`**, **`pastMedicalHistory`**
  — `.max(500).optional()` (`patient.ts:58-61`), read via `nullableStr()`
  (`mappers.ts:47-50`) → **not required**.
- **`identificationNumber`** — `.max(50).optional()` (`patient.ts:65`).
- **`privacyConsent`**, **`treatmentConsent`**, **`disclosureConsent`** — `Patient.*Consent:
  boolean` (`types.ts:62-64`), `consentSchema` requires exactly `true` to submit
  (`primitives.ts:31-32`); `patientToDocument` always includes them since they're required keys
  of `RegisterPatientInput`. Read via `Boolean()` (`mappers.ts:55-57`) — that coercion is
  defensive against a corrupt document, not evidence the attribute is optional.
- **`gender`**, **`status`-style enums** — `GENDERS = ["male","female","other"]`
  (`types.ts:14-16`); mapper falls back to `"other"` for anything unrecognised
  (`mappers.ts:109-114`), which is corruption-handling, not an optional-attribute signal — the
  domain type `Gender` is non-nullable and `patient.ts:32` requires the enum.

### 2.2 Appointment collection

Source: `Appointment` interface (`types.ts:70-82`), `toAppointment`
(`mappers.ts:62-81`), writes in `createAppointment`/`updateAppointment`
(`appwrite.repository.ts:110-135, 153-169`).

| Attribute key | Appwrite type | Size/params | Required | Default | Array? |
|---|---|---|---|---|---|
| `userId` | string | 36 | Yes | — | No |
| `patient` | **relationship** (see below) | related collection: `patient`; type: Many-to-One | Yes | — | No |
| `primaryPhysician` | string | 100 (open question — see §9) | Yes | — | No |
| `schedule` | datetime | — | Yes | — | No |
| `status` | string, `format: enum` | elements `["pending","scheduled","cancelled"]` | Yes | — | No |
| `reason` | string | 500 | Yes | — | No |
| `note` | string | 500 | No | `""` | No |
| `cancellationReason` | string | 500 | No | null | No |

`id` and `createdAt` map to `$id`/`$createdAt` (`mappers.ts:68,79`) — not custom attributes.

Per-attribute justification:

- **`userId`** — written directly at `appwrite.repository.ts:120` (`userId: input.userId`), read
  with `str()` (`mappers.ts:69`), `Appointment.userId: string` (`types.ts:72`, non-null). Same
  36-char Appwrite-ID reasoning as the Patient collection's `userId`.
- **`patient` — this is a relationship, not a plain string.** The code says so explicitly:
  > `// 'patient' is a relationship attribute, so Appwrite expands it into a full nested document
  > on read but expects a bare id string on write.` — `mappers.ts:63-64`
  and again at the write site:
  > `// Relationship attribute: written as an id, read back expanded.` — `appwrite.repository.ts:121-122`

  On create, the code writes `patient: input.patientId` (`appwrite.repository.ts:122`) — a bare
  patient document ID — and on read, `doc.patient` arrives as an expanded nested document or
  `null` (`mappers.ts:65,70-72`). Configure it in the Appwrite console as: related collection
  `patient`, relationship type **Many to One** (many appointments can reference the same patient
  — nothing in the code enforces one appointment per patient), key `patient`. Two-way-ness and
  on-delete behaviour are not settled by the code (see §9) because `DataRepository`
  (`lib/data/repository.ts`) has no delete method at all — deletion is never exercised.
  Required: the create path always supplies a patient ID (`appwrite.repository.ts:122`); the
  mapper's `placeholderPatient()` fallback (`mappers.ts:127-156`) exists only to keep the admin
  table rendering if an expansion fails at read time (e.g. a deleted patient document), not
  because the attribute is optional by design.
- **`schedule`** — ISO string always supplied (`values.schedule.toISOString()`,
  `appwrite.repository.ts:124`), read via `iso()` (`mappers.ts:74`).
- **`status`** — `AppointmentStatus` enum (`types.ts:18-24`); always supplied on create/update
  (`appwrite.repository.ts:125`, `lib/actions/appointment.actions.ts:129`); mapper's
  `status()` fallback to `"pending"` (`mappers.ts:116-121`) is corruption-handling.
- **`reason`** — `reasonRequired`, `.min(2).max(500)`, used only in `CreateAppointmentSchema`
  (`lib/validation/appointment.ts:19-23,34`); never updated afterward (`appointment.actions.ts:126-132`
  does not touch `reason`). Read via `str()` (`mappers.ts:76`), domain type non-null
  (`types.ts:78`).
- **`note`** — optional at every schema (`appointment.ts:35,42-43,50-51` — `.max(500).optional()`);
  read via `nullableStr()` (`mappers.ts:77`) which folds `""` back to `null`. On create the
  repository writes `note: input.note ?? ""` (`appwrite.repository.ts:127`) — never an omitted
  key, so a default of `""` matches what the code actually sends.
- **`cancellationReason`** — optional in all three appointment schemas
  (`appointment.ts:36,44,52` for the base optional case; `cancellationRequired` only tightens it
  to required *client-side* when cancelling); on create the repository writes the literal `null`
  (`appwrite.repository.ts:128`); read via `nullableStr()` (`mappers.ts:78`); domain type is
  `string | null` (`types.ts:80`).
- **`primaryPhysician`** — same "no max validation found" gap as the Patient collection's field
  of the same name; see §9.

## 3. Indexes

Every index below is required by a specific `Query.*` call in
`lib/data/appwrite/appwrite.repository.ts`. None are speculative.

### Patient collection

| Key | Type | Attributes | Order | Cited by |
|---|---|---|---|---|
| `idx_userId` | key | `userId` | ASC | `getPatientByUserId`: `Query.equal("userId", [userId])`, `appwrite.repository.ts:99` |

### Appointment collection

| Key | Type | Attributes | Order | Cited by |
|---|---|---|---|---|
| `idx_status` | key | `status` | ASC | `listAppointments` status filter, `appwrite.repository.ts:182` (`Query.equal("status", [query.status])`); also `getBookedSlots`, `:254` (`Query.notEqual("status", ["cancelled"])`); also required by the count-query fix in §6 |
| `idx_primaryPhysician_search` | **fulltext** | `primaryPhysician` | — | `listAppointments` search, `appwrite.repository.ts:185` (`Query.search("primaryPhysician", query.search)`) |
| `idx_primaryPhysician_schedule` | key | `primaryPhysician`, `schedule` | ASC, ASC | `getBookedSlots`, `appwrite.repository.ts:251-253` (`Query.equal("primaryPhysician", …)` + `Query.greaterThanEqual`/`lessThanEqual("schedule", …)`) |
| `idx_schedule` | key | `schedule` | ASC | `listAppointments` date-range filters, `appwrite.repository.ts:187-188`, and `Query.orderAsc`/`orderDesc(sortField)` when `sortField === "schedule"`, `:190-195` |
| `idx_userId_schedule` | key | `userId`, `schedule` | ASC, DESC | `listAppointmentsByUser`, `appwrite.repository.ts:231-233` (`Query.equal("userId", [userId])` + `Query.orderDesc("schedule")`) |

**`idx_primaryPhysician_search` must be created as `fulltext`, not `key`.** Appwrite's
`Query.search()` only works against a fulltext index; a `key` index on the same attribute
supports `Query.equal`/`Query.notEqual` (which `idx_primaryPhysician_schedule` already covers for
`getBookedSlots`) but returns no results for `Query.search`, and the search box would silently
stop matching doctors with no error.

The default `$createdAt` sort path (`sortField` falls back to `"$createdAt"` at
`appwrite.repository.ts:190` for anything other than `"schedule"`) needs no custom index —
`$createdAt` is an Appwrite system attribute and is always orderable.

## 4. Storage bucket

- **Bucket ID:** whatever you set `NEXT_PUBLIC_BUCKET_ID` to (`lib/env.ts:27`, read at
  `client.ts:59,71`). Example: `identification-documents`.
- **Max file size:** 5,242,880 bytes (5 MiB) — `MAX_UPLOAD_BYTES = 5 * 1024 * 1024`
  (`constants/index.ts:82`), enforced a second time server-side at
  `lib/actions/patient.actions.ts:80-85` (`if (file.size > MAX_UPLOAD_BYTES) throw …`).
- **Allowed file extensions:** `png`, `jpg`, `jpeg`, `webp`, `pdf` — from
  `ACCEPTED_UPLOAD_TYPES` (`constants/index.ts:84-89`), which the dropzone's `accept` prop
  enforces client-side (`components/FileUploader.tsx:72`).
  **This bucket setting is the only server-side enforcement of file type.** The Server Action
  that receives the upload validates only size, not MIME type or extension
  (`lib/actions/patient.actions.ts:80-85` — no type check anywhere in that function). A request
  built to bypass the dropzone (e.g. a direct POST to the Server Action) would reach Appwrite
  with no application-level type check at all; the bucket's `allowedFileExtensions` is what stops
  it.
- **Permissions — must include `read(any)` at the bucket level.** Two facts force this:
  1. `storage.createFile()` is called with no `permissions` argument
     (`appwrite.repository.ts:272-277`), and the SDK's own docs are explicit that "By default, no
     user is granted with any permissions" for a created file
     (`node_modules/node-appwrite/dist/services/storage.d.ts:90`).
  2. The URL handed back to the browser is built by hand with no session or API key attached:
     `` `${ids.endpoint}/storage/buckets/${ids.bucketId}/files/${fileId}/view?project=${ids.projectId}` ``
     (`client.ts:69-72`). The admin UI that would eventually display this URL never authenticates
     to Appwrite at all — the only Appwrite `Client()` construction in the codebase is the
     server-side API-key client in `client.ts:45-48`; admin auth is a separate signed passkey
     cookie (`README.md:84-85`), not an Appwrite session.

  Without bucket-level `read(any)`, every uploaded identification document is permanently
  unviewable by anyone, including staff, once created.
- **File Security: off.** If File Security were on, the empty per-file permissions from point 1
  above would apply *instead of* the bucket-level permissions, and the file would still be
  unreadable by anyone without an Appwrite session (which nothing in this app ever has). Turning
  File Security off makes the bucket-level `read(any)` grant the one that governs every file.
- **Create/Update/Delete permissions:** none needed for any role. The only writer is the
  server-side API key (`appwrite.repository.ts:273-277`), and API keys bypass bucket permission
  checks entirely — see the reasoning in §1 step 4.
- **Encryption / Antivirus / Compression:** no requirement found in code. Recommend leaving
  Appwrite's defaults (encryption on; antivirus on if available on your plan; compression
  `none`). Flagged in §9 as not code-derived.

## 5. API key scopes

Minimum scopes for the **runtime** key — the one that goes into `.env.local`'s `API_KEY` and is
used by `getAppwrite()` (`client.ts:40-66`) for every request the running app makes:

| Scope | Required for |
|---|---|
| `users.read` | `users.list(...)` in `createUser`'s conflict-resume path, `appwrite.repository.ts:54-59`; `users.get(...)` in `getUser`, `:68` |
| `users.write` | `users.create(...)` in `createUser`, `appwrite.repository.ts:41-46` |
| `documents.read` | `databases.listDocuments`/`getDocument` — `getPatientByUserId` (`:96-101`), `getAppointment` (`:140-144`), `listAppointments` (`:200-211`), `listAppointmentsByUser` (`:226-234`), `getBookedSlots` (`:246-256`) |
| `documents.write` | `databases.createDocument` — `registerPatient` (`:81-86`), `createAppointment` (`:115-129`); `databases.updateDocument` — `updateAppointment` (`:159-164`) |
| `files.write` | `storage.createFile(...)` in `uploadIdentificationDocument`, `appwrite.repository.ts:273-277` |
| `messages.write` | `messaging.createSms(...)` in `sendSmsNotification`, `lib/services/notifications.ts:59-63` |

Scope identifiers confirmed against the installed SDK's own enum:
`node_modules/node-appwrite/dist/enums/project-key-scopes.d.ts`.

Not needed by the runtime key, because no code path calls the corresponding operations:
`databases.read`/`databases.write` (no `getDatabase`/collection-schema calls — those govern
database/collection *administration*, not document CRUD, which uses `documents.*`),
`collections.write`, `attributes.write`, `indexes.write`, `buckets.read`/`buckets.write`
(no `storage.getBucket`/`listBuckets`/`createBucket` calls), `files.read` (no
`storage.getFile`/`getFileView` calls — `fileViewUrl()` builds the URL by hand rather than
fetching through the SDK, `client.ts:69-72`), `messages.read`, `topics.*`, `targets.*`.

**Provisioning is a separate credential.** Creating the database, collections, attributes,
indexes and bucket themselves (§1–§4) requires `databases.write`, `collections.write`,
`attributes.write`, `indexes.write`, `buckets.write` — but that work is done once, via
`appwrite login`/`appwrite push` or the console, and should not be granted to the long-lived key
that sits in `.env.local`. Keep the two credentials separate.

## 6. Two known adapter bugs

These are documented, not fixed, per the scope of this task.

### 6.1 Search divergence

The Appwrite adapter searches one field:

```ts
// appwrite.repository.ts:184-186
if (query.search) {
  queries.push(Query.search("primaryPhysician", query.search));
}
```

The demo adapter searches four:

```ts
// demo.repository.ts:224-237
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
```

The domain type's own doc comment describes the intended behaviour and does not match what the
Appwrite adapter does:

> `/** Free-text match against patient name, email and doctor. */` — `lib/data/types.ts:107-108`

So even the comment (which omits `reason`, a fifth minor slip) promises patient name and email;
the Appwrite adapter delivers neither.

**Why Appwrite can't search across the relationship directly:** `patient.name` and
`patient.email` are attributes of the *patient* collection, reached from an appointment only
through the `patient` relationship attribute (§2.2). `Query.search()` requires a `fulltext`
index on an attribute of the collection being listed (`databases.listDocuments` on the
*appointment* collection); Appwrite has no fulltext index type that spans a relationship, and no
`Query.search()` variant that dereferences one to search the related document's fields. There is
no query-side fix.

**Recommended fix:** denormalise a concatenated field onto the appointment document itself, e.g.
a new `searchText` string attribute containing
`` `${patient.name} ${patient.email} ${primaryPhysician} ${reason}`.toLowerCase() ``, with a
`fulltext` index on it, and change line 185 to `Query.search("searchText", query.search)`. That
requires:

1. A new `searchText` attribute on the Appointment collection (size ~600 is comfortable for four
   concatenated fields; not required, since it is app-maintained, not user-facing — recompute it
   server-side, never trust client input).
2. `createAppointment` (`appwrite.repository.ts:110-135`) to compute it at write time. Note this
   needs the patient's name and email, which `CreateAppointmentInput` (`types.ts:127-135`)
   currently does not carry — only `patientId`. The repository would need to either fetch the
   patient first, or the caller (`lib/actions/appointment.actions.ts`) would need to pass the
   patient record through.
3. `updateAppointment` (`appwrite.repository.ts:153-169`) to recompute `searchText` whenever
   `primaryPhysician` changes (it does, on reschedule — `appointment.actions.ts:126-132`), since
   the reschedule flow changes exactly the field the current search already covers.
4. If a patient's name or email is ever edited after registration (not possible today — there is
   no `updatePatient` in `DataRepository`, `lib/data/repository.ts:41-42` — but worth flagging for
   whoever adds one later), every appointment referencing that patient would need its
   `searchText` recomputed too, or the search index goes stale.

### 6.2 Status counts don't scale

```ts
// appwrite.repository.ts:199-218
const [pageResult, countsResult] = await Promise.all([
  databases.listDocuments({ /* ...filtered, paginated query... */ }),
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
```

`Query.limit(1000)` is already at Appwrite's own per-request ceiling — it cannot be raised
further. Once the appointment collection holds more than 1000 documents, this call fetches an
arbitrary 1000-document slice (no explicit order is given, so the slice boundary is whatever
Appwrite's default ordering returns), and `countByStatus` (`demo.repository.ts:207-217`, reused
by the Appwrite adapter via the import at `appwrite.repository.ts:20`) tallies only that slice.
The scheduled/pending/cancelled StatCards on the dashboard then silently under-report — no
error, no log, no visible signal — and stay wrong for the life of the clinic once the 1000-row
mark is crossed.

**Recommended fix:** three lightweight per-status queries instead of one 1000-row read, using
`Models.DocumentList.total` — confirmed in the installed SDK
(`node_modules/node-appwrite/dist/models.d.ts:42-44`, "Total number of documents that matched
your query") to be a server-computed count of *all* matching documents, independent of the
query's `limit`. `databases.listDocuments`'s params object also exposes a `total?: boolean` flag
for the same purpose (`node_modules/node-appwrite/dist/services/databases.d.ts:1904-1911`).
Concretely:

```ts
const [scheduled, pending, cancelled] = await Promise.all(
  (["scheduled", "pending", "cancelled"] as const).map((status) =>
    databases.listDocuments({
      databaseId: ids.databaseId,
      collectionId: ids.appointmentCollectionId,
      queries: [Query.equal("status", [status]), Query.limit(1)],
    }),
  ),
);
const counts = {
  scheduledCount: scheduled.total,
  pendingCount: pending.total,
  cancelledCount: cancelled.total,
};
```

`Query.limit(1)` keeps the document payload negligible; `.total` is the real count regardless.
This is exactly why `idx_status` (§3) needs to exist — three `Query.equal("status", …)` scans
per dashboard load should hit an index, not a full collection scan.

### 6.3 `sort=patient` is silently ignored

A third divergence of the same class as §6.1, not listed in the original brief. Found while
deriving this document.

`lib/api/schemas.ts:19` accepts three sort values from the read API:

```ts
sort: z.enum(["schedule", "createdAt", "patient"]).default("createdAt"),
```

`lib/data/appwrite/appwrite.repository.ts:190` honours one of them:

```ts
const sortField = query.sort === "schedule" ? "schedule" : "$createdAt";
```

So `?sort=patient` is accepted by validation, returns 200, and quietly sorts by creation date. The
demo repository sorts by patient name, so the two implementations disagree — and the contract suite
did not catch it for the same reason it missed the search divergence: it only ever runs against demo.

**Why it is grouped with §6.1.** Appwrite cannot sort on a relationship attribute any more than it
can search one. The denormalised searchable field proposed in §6.1 solves both: if the appointment
document carries the patient's name as a plain string attribute, that attribute can take a `key`
index and serve `Query.orderAsc`/`orderDesc` directly. Fixing search and fixing sort is one change,
not two — which is why they should be done together rather than sequenced.

**Do not fix this before the search work.** A standalone fix would either duplicate the
denormalisation or narrow the API to drop `"patient"` from the enum, and the latter is a silent
capability regression for any client already sending it.

## 7. `appwrite.json`

No Appwrite CLI config exists in this repo today (confirmed: no `appwrite.json`, no `.appwrite/`
directory). The file below follows the Appwrite CLI's public `appwrite.json` schema — every
attribute and index in it matches §2–§3 exactly, cross-checked field by field. The CLI itself is
not installed in this repo, so run `appwrite push` (or `appwrite deploy collection` /
`appwrite deploy bucket`) and resolve whatever shape errors it reports before trusting this file
blindly — see §9.

Replace `PROJECT_ID_HERE` with your real project ID before running `appwrite push`.

```json
{
  "projectId": "PROJECT_ID_HERE",
  "projectName": "CarePulse",
  "databases": [
    {
      "$id": "carepulse",
      "name": "CarePulse",
      "enabled": true
    }
  ],
  "collections": [
    {
      "$id": "patient",
      "$permissions": [],
      "databaseId": "carepulse",
      "name": "Patient",
      "enabled": true,
      "documentSecurity": false,
      "attributes": [
        { "key": "userId", "type": "string", "size": 36, "required": true, "array": false, "default": null },
        { "key": "name", "type": "string", "size": 50, "required": true, "array": false, "default": null },
        { "key": "email", "type": "string", "size": 320, "required": true, "array": false, "default": null },
        { "key": "phone", "type": "string", "size": 20, "required": true, "array": false, "default": null },
        { "key": "birthDate", "type": "datetime", "required": true, "array": false, "default": null },
        { "key": "gender", "type": "string", "format": "enum", "elements": ["male", "female", "other"], "size": 6, "required": true, "array": false, "default": null },
        { "key": "address", "type": "string", "size": 500, "required": true, "array": false, "default": null },
        { "key": "occupation", "type": "string", "size": 500, "required": true, "array": false, "default": null },
        { "key": "emergencyContactName", "type": "string", "size": 50, "required": true, "array": false, "default": null },
        { "key": "emergencyContactNumber", "type": "string", "size": 20, "required": true, "array": false, "default": null },
        { "key": "primaryPhysician", "type": "string", "size": 100, "required": true, "array": false, "default": null },
        { "key": "insuranceProvider", "type": "string", "size": 50, "required": true, "array": false, "default": null },
        { "key": "insurancePolicyNumber", "type": "string", "size": 50, "required": true, "array": false, "default": null },
        { "key": "allergies", "type": "string", "size": 500, "required": false, "array": false, "default": null },
        { "key": "currentMedication", "type": "string", "size": 500, "required": false, "array": false, "default": null },
        { "key": "familyMedicalHistory", "type": "string", "size": 500, "required": false, "array": false, "default": null },
        { "key": "pastMedicalHistory", "type": "string", "size": 500, "required": false, "array": false, "default": null },
        { "key": "identificationType", "type": "string", "size": 100, "required": false, "array": false, "default": null },
        { "key": "identificationNumber", "type": "string", "size": 50, "required": false, "array": false, "default": null },
        { "key": "identificationDocumentId", "type": "string", "size": 36, "required": false, "array": false, "default": null },
        { "key": "identificationDocumentUrl", "type": "string", "size": 2048, "required": false, "array": false, "default": null },
        { "key": "privacyConsent", "type": "boolean", "required": true, "array": false, "default": null },
        { "key": "treatmentConsent", "type": "boolean", "required": true, "array": false, "default": null },
        { "key": "disclosureConsent", "type": "boolean", "required": true, "array": false, "default": null }
      ],
      "indexes": [
        { "key": "idx_userId", "type": "key", "attributes": ["userId"], "orders": ["ASC"] }
      ]
    },
    {
      "$id": "appointment",
      "$permissions": [],
      "databaseId": "carepulse",
      "name": "Appointment",
      "enabled": true,
      "documentSecurity": false,
      "attributes": [
        { "key": "userId", "type": "string", "size": 36, "required": true, "array": false, "default": null },
        {
          "key": "patient",
          "type": "relationship",
          "required": true,
          "array": false,
          "relatedCollection": "patient",
          "relationType": "manyToOne",
          "twoWay": true,
          "twoWayKey": "appointments",
          "onDelete": "setNull",
          "side": "parent"
        },
        { "key": "primaryPhysician", "type": "string", "size": 100, "required": true, "array": false, "default": null },
        { "key": "schedule", "type": "datetime", "required": true, "array": false, "default": null },
        { "key": "status", "type": "string", "format": "enum", "elements": ["pending", "scheduled", "cancelled"], "size": 9, "required": true, "array": false, "default": null },
        { "key": "reason", "type": "string", "size": 500, "required": true, "array": false, "default": null },
        { "key": "note", "type": "string", "size": 500, "required": false, "array": false, "default": "" },
        { "key": "cancellationReason", "type": "string", "size": 500, "required": false, "array": false, "default": null }
      ],
      "indexes": [
        { "key": "idx_status", "type": "key", "attributes": ["status"], "orders": ["ASC"] },
        { "key": "idx_primaryPhysician_search", "type": "fulltext", "attributes": ["primaryPhysician"], "orders": ["ASC"] },
        { "key": "idx_primaryPhysician_schedule", "type": "key", "attributes": ["primaryPhysician", "schedule"], "orders": ["ASC", "ASC"] },
        { "key": "idx_schedule", "type": "key", "attributes": ["schedule"], "orders": ["ASC"] },
        { "key": "idx_userId_schedule", "type": "key", "attributes": ["userId", "schedule"], "orders": ["ASC", "DESC"] }
      ]
    }
  ],
  "buckets": [
    {
      "$id": "identification-documents",
      "$permissions": ["read(\"any\")"],
      "fileSecurity": false,
      "name": "Identification Documents",
      "enabled": true,
      "maximumFileSize": 5242880,
      "allowedFileExtensions": ["png", "jpg", "jpeg", "webp", "pdf"],
      "compression": "none",
      "encryption": true,
      "antivirus": true
    }
  ]
}
```

After `appwrite push` succeeds, copy the resulting IDs (`carepulse`, `patient`, `appointment`,
`identification-documents`, or whatever you renamed them to) into `.env.local` exactly as
created — the application code has no defaults for any of them.

## 8. Environment variables

| Variable | Required in live mode? | Read at | Example shape |
|---|---|---|---|
| `NEXT_PUBLIC_ENDPOINT` | Yes | `lib/env.ts:21`; `client.ts:46,71` | `https://cloud.appwrite.io/v1` |
| `PROJECT_ID` | Yes | `lib/env.ts:22`; `client.ts:47,61,71` | `68f2a1...` (Appwrite project ID) |
| `API_KEY` | Yes | `lib/env.ts:23`; `client.ts:48` | a long server API key secret — never commit |
| `DATABASE_ID` | Yes | `lib/env.ts:24`; `client.ts:56` | `carepulse` |
| `PATIENT_COLLECTION_ID` | Yes | `lib/env.ts:25`; `client.ts:57` | `patient` |
| `APPOINTMENT_COLLECTION_ID` | Yes | `lib/env.ts:26`; `client.ts:58` | `appointment` |
| `NEXT_PUBLIC_BUCKET_ID` | Yes | `lib/env.ts:27`; `client.ts:59,71` | `identification-documents` |
| `NODE_ENV` | No (defaults `development`) | `lib/env.ts:31-33` | `production` |
| `ADMIN_PASSKEY` | No (defaults `123456` — change for anything beyond local demo) | `lib/env.ts:40-43` | 6 digits, e.g. `482913` |
| `ADMIN_SESSION_SECRET` | No (defaults to an insecure dev string; set a real one outside local demo) | `lib/env.ts:45-49` | 32+ random characters |
| `DEMO_SEED` | No (defaults `42`) | `lib/env.ts:52` | `42` |
| `DEMO_MODE` | No (forces demo mode even if Appwrite vars are set) | `lib/env.ts:54-58` | `true` or unset |

All seven Appwrite variables must be set together — `lib/env.ts:92-110` throws at boot if any
subset of them is present without the rest, rather than silently falling back to demo mode.

## 9. Open questions

Things this document could not settle from code alone:

1. **`email` max length** — `emailSchema` is `z.email({...})` with no `.max()`
   (`lib/validation/primitives.ts:18`). No validation found. Recommended 320 (RFC 5321's mailbox
   length ceiling), not code-derived.
2. **`primaryPhysician` max length** (both collections) — both schemas only enforce
   `.min(2, {...})` (`patient.ts:47`; `appointment.ts:3`). No max found. Recommended 100.
3. **`identificationType` max length** — `z.string().optional()` with no `.max()`
   (`patient.ts:64`), even though the UI only ever offers the fixed
   `IdentificationTypes` list (`constants/index.ts:12-24`, longest entry 33 characters). Nothing
   stops a differently-sourced string from exceeding that. Recommended 100.
4. **`identificationDocumentId` max length** — no validation in code. Recommended 36, based on
   Appwrite's own generated-ID length convention (`ID.unique()` is used for the matching file
   creation at `appwrite.repository.ts:275`), not on an application-level check.
5. **`identificationDocumentUrl` max length** — no validation in code; it's a constructed URL
   (`client.ts:69-72`). Recommended 2048 as a generous, conventional URL-length ceiling.
6. **`patient` relationship on-delete behaviour** — `DataRepository` (`lib/data/repository.ts`)
   has no delete method for either patients or appointments, so `onDelete` is never exercised by
   the running app. This document's `appwrite.json` picks `setNull` so a manual deletion in the
   console doesn't hard-fail, but that is an operator policy choice, not something the code
   settles.
7. **`patient` relationship two-way-ness** — the code only ever traverses appointment → patient
   (`mappers.ts:65,70-72`); nothing reads a patient's appointments through the relationship (the
   reverse lookup instead goes through `userId` equality, `appwrite.repository.ts:224-240`). A
   one-way relationship would satisfy the code as written; this document configures it two-way
   because that's the Appwrite console default and costs nothing extra, but a one-way
   relationship is an equally valid, code-consistent choice.
8. **Bucket encryption / antivirus / compression** — no requirement found in code. Recommended
   Appwrite's defaults (encryption on, antivirus on where available, compression `none`).
9. **`appwrite.json` envelope shape** — its attribute/index *content* is cross-checked against
   §2–§3 field by field, but the surrounding JSON structure follows the publicly documented
   Appwrite CLI convention rather than something verified against an installed CLI (none is
   present in this repo). Run `appwrite push` and fix any schema-shape errors it reports.
10. **Deprecated `Databases` API** — every method `appwrite.repository.ts` calls
    (`listDocuments`, `createDocument`, `getDocument`, `updateDocument`) is marked deprecated
    since Appwrite 1.8.0 in the installed SDK's own type definitions, in favor of `TablesDB`
    (`node_modules/node-appwrite/dist/services/databases.d.ts:1902` and equivalently throughout
    that file). This document provisions classic Collections/Documents because that's what the
    shipped adapter calls, but a future Appwrite server major version could remove the legacy
    endpoints, breaking this adapter independent of anything in this document. Out of scope to
    fix here; worth flagging to whoever owns the codebase.
11. **Exact ID strings** — `lib/env.ts`'s `AppwriteEnvSchema` (`:20-28`) has no `.default()` on
    any of the seven Appwrite variables, so the code imposes no naming convention at all. Every
    ID in §7 (`carepulse`, `patient`, `appointment`, `identification-documents`) is this
    document's suggestion, not a code requirement — name them however you like, then copy
    whatever you actually created into `.env.local`.
12. **Live Appwrite server version** — not independently verified against a running server; this
    document relies on `.env.example:18-19`'s statement that `node-appwrite@28` targets Appwrite
    Server 1.9.x.
