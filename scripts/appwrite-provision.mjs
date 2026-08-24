/**
 * Reconciles a live Appwrite project against the schema this app actually needs.
 *
 *   node --env-file=.env scripts/appwrite-provision.mjs --dry-run
 *   node --env-file=.env scripts/appwrite-provision.mjs
 *
 * Idempotent: it diffs live state against SPEC below and applies only the
 * difference, so re-running a converged project is a no-op. Written because the
 * project this was first pointed at had been provisioned from the original
 * tutorial scaffold — a typo'd `primaryPhyisician`, two missing consent
 * booleans, six attributes sized 100 where validation allows 500, and an
 * appointment collection with zero attributes. A console checklist cannot be
 * re-run or diffed; this can.
 *
 * Needs a provisioning API key (collections/attributes/indexes/buckets write),
 * which per docs/APPWRITE_SETUP.md §5 is deliberately NOT the runtime key's
 * scope set. Point it at .env only when that env's key is privileged enough.
 *
 * Uses the deprecated `Databases` surface on purpose: the shipped adapter
 * (lib/data/appwrite/) is built on classic Collections, so provisioning Tables
 * would produce a schema the app cannot read. See APPWRITE_SETUP.md §9.10.
 */
import { Client, Databases, Storage } from "node-appwrite";

const DRY_RUN = process.argv.includes("--dry-run");

const {
  NEXT_PUBLIC_ENDPOINT,
  PROJECT_ID,
  API_KEY,
  DATABASE_ID,
  PATIENT_COLLECTION_ID,
  APPOINTMENT_COLLECTION_ID,
  NEXT_PUBLIC_BUCKET_ID,
} = process.env;

for (const [key, value] of Object.entries({
  NEXT_PUBLIC_ENDPOINT,
  PROJECT_ID,
  API_KEY,
  DATABASE_ID,
  PATIENT_COLLECTION_ID,
  APPOINTMENT_COLLECTION_ID,
  NEXT_PUBLIC_BUCKET_ID,
})) {
  if (!value?.trim()) {
    console.error(`Missing ${key}. Run with --env-file=.env`);
    process.exit(1);
  }
}

/* --------------------------------- spec ---------------------------------- */

/**
 * Sizes come from the Zod schemas in lib/validation/, not from guesswork —
 * docs/APPWRITE_SETUP.md §2 cites the line for each one. Where the code sets no
 * bound, §9 records the recommendation being used here.
 */
const patientAttributes = [
  { key: "userId", type: "string", size: 36, required: true },
  { key: "name", type: "string", size: 50, required: true },
  // Appwrite's email format rather than a plain string: it validates at the
  // storage layer, which zod's z.email() cannot do for writes that bypass the
  // form. Supersedes §9.1's "recommend 320", which was explicitly not
  // code-derived.
  { key: "email", type: "email", required: true },
  { key: "phone", type: "string", size: 20, required: true },
  { key: "birthDate", type: "datetime", required: true },
  {
    key: "gender",
    type: "enum",
    elements: ["male", "female", "other"],
    required: true,
  },
  { key: "address", type: "string", size: 500, required: true },
  { key: "occupation", type: "string", size: 500, required: true },
  { key: "emergencyContactName", type: "string", size: 50, required: true },
  { key: "emergencyContactNumber", type: "string", size: 20, required: true },
  { key: "primaryPhysician", type: "string", size: 100, required: true },
  { key: "insuranceProvider", type: "string", size: 50, required: true },
  { key: "insurancePolicyNumber", type: "string", size: 50, required: true },
  { key: "allergies", type: "string", size: 500, required: false },
  { key: "currentMedication", type: "string", size: 500, required: false },
  { key: "familyMedicalHistory", type: "string", size: 500, required: false },
  { key: "pastMedicalHistory", type: "string", size: 500, required: false },
  { key: "identificationType", type: "string", size: 100, required: false },
  { key: "identificationNumber", type: "string", size: 50, required: false },
  { key: "identificationDocumentId", type: "string", size: 36, required: false },
  // fileViewUrl() builds a 126-character URL for a cloud.appwrite.io project;
  // the tutorial scaffold sized this 100, which fails every upload.
  {
    key: "identificationDocumentUrl",
    type: "string",
    size: 2048,
    required: false,
  },
  { key: "privacyConsent", type: "boolean", required: true },
  { key: "treatmentConsent", type: "boolean", required: true },
  { key: "disclosureConsent", type: "boolean", required: true },
];

const appointmentAttributes = [
  { key: "userId", type: "string", size: 36, required: true },
  {
    key: "patient",
    type: "relationship",
    relatedCollectionId: PATIENT_COLLECTION_ID,
    relationType: "manyToOne",
    // One-way: the code only ever traverses appointment → patient
    // (mappers.ts:65). The reverse lookup goes through userId equality instead.
    // §9.7 records two-way as an equally valid choice; one-way avoids adding an
    // undocumented `appointments` attribute to the patient collection.
    twoWay: false,
    onDelete: "setNull",
  },
  { key: "primaryPhysician", type: "string", size: 100, required: true },
  { key: "schedule", type: "datetime", required: true },
  {
    key: "status",
    type: "enum",
    elements: ["pending", "scheduled", "cancelled"],
    required: true,
  },
  { key: "reason", type: "string", size: 500, required: true },
  { key: "note", type: "string", size: 500, required: false, xdefault: "" },
  { key: "cancellationReason", type: "string", size: 500, required: false },

  /*
   * The two denormalised attributes that fix APPWRITE_SETUP.md §6.1 and §6.3.
   *
   * Appwrite can neither search nor sort across a relationship, so the patient
   * fields the admin table filters and sorts on have to live on the appointment
   * document itself. App-maintained, so both are optional — a document written
   * by anything other than this app simply won't be searchable.
   */
  // 50 (name) + 320 (email) + 100 (physician) + 500 (reason) + separators.
  { key: "searchText", type: "string", size: 1000, required: false },
  { key: "patientName", type: "string", size: 100, required: false },
];

const patientIndexes = [
  // getPatientByUserId: Query.equal("userId", …) — appwrite.repository.ts:99
  { key: "idx_userId", type: "key", attributes: ["userId"], orders: ["ASC"] },
];

const appointmentIndexes = [
  // Status filter, and the three per-status count queries that replaced the
  // 1000-row tally.
  { key: "idx_status", type: "key", attributes: ["status"], orders: ["ASC"] },
  // getBookedSlots: equal(primaryPhysician) + range(schedule).
  {
    key: "idx_primaryPhysician_schedule",
    type: "key",
    attributes: ["primaryPhysician", "schedule"],
    orders: ["ASC", "ASC"],
  },
  // listAppointments date-range filters and sort=schedule.
  { key: "idx_schedule", type: "key", attributes: ["schedule"], orders: ["ASC"] },
  // listAppointmentsByUser: equal(userId) + orderDesc(schedule).
  {
    key: "idx_userId_schedule",
    type: "key",
    attributes: ["userId", "schedule"],
    orders: ["ASC", "DESC"],
  },
  // Query.search(searchText, …). Must be fulltext — a key index returns nothing
  // for Query.search, silently.
  { key: "idx_searchText", type: "fulltext", attributes: ["searchText"] },
  // sort=patient: Query.orderAsc/orderDesc("patientName").
  {
    key: "idx_patientName",
    type: "key",
    attributes: ["patientName"],
    orders: ["ASC"],
  },
];

/**
 * Deliberately absent: `idx_primaryPhysician_search` (fulltext on
 * primaryPhysician), which APPWRITE_SETUP.md §3 required. Search now runs
 * against `searchText`, which already contains the physician name, so that
 * index would be dead weight.
 */

const bucketSpec = {
  // MAX_UPLOAD_BYTES = 5 * 1024 * 1024 (constants/index.ts), re-checked in
  // patient.actions.ts. The scaffold's 5_000_000 left a 242 KB band where the
  // app accepts a file and Appwrite rejects it.
  maximumFileSize: 5 * 1024 * 1024,
  allowedFileExtensions: ["png", "jpg", "jpeg", "webp", "pdf"],
  // createFile() passes no per-file permissions and fileViewUrl() builds an
  // unauthenticated URL, so bucket-level read(any) with File Security off is
  // what makes an uploaded document viewable at all. See §4.
  permissions: ['read("any")'],
  fileSecurity: false,
};

/* -------------------------------- helpers -------------------------------- */

const client = new Client()
  .setEndpoint(NEXT_PUBLIC_ENDPOINT)
  .setProject(PROJECT_ID)
  .setKey(API_KEY);

const databases = new Databases(client);
const storage = new Storage(client);

const plan = [];
let applied = 0;
let failed = 0;

function record(action, detail) {
  plan.push({ action, detail });
  console.log(`  ${DRY_RUN ? "[plan]" : "[apply]"} ${action}: ${detail}`);
}

async function apply(action, detail, fn) {
  record(action, detail);
  if (DRY_RUN) return null;
  try {
    const result = await fn();
    applied += 1;
    return result;
  } catch (error) {
    failed += 1;
    console.error(
      `      !! ${error.code ?? "?"} ${error.type ?? ""} — ${error.message}`,
    );
    return null;
  }
}

/** Live attribute type, normalised onto the SPEC vocabulary. */
function liveType(attr) {
  if (attr.type === "string" && attr.format === "enum") return "enum";
  if (attr.type === "string" && attr.format === "email") return "email";
  return attr.type;
}

function describeLive(attr) {
  const bits = [liveType(attr)];
  if (attr.size) bits.push(`size=${attr.size}`);
  bits.push(attr.required ? "required" : "optional");
  if (attr.elements) bits.push(`[${attr.elements.join("|")}]`);
  if (attr.relatedCollection) {
    bits.push(`->${attr.relatedCollection}`, attr.relationType);
    bits.push(`twoWay=${attr.twoWay}`);
  }
  if (attr.status !== "available") bits.push(`status=${attr.status}`);
  return bits.join(" ");
}

/**
 * Attributes and indexes are created asynchronously — an index built against an
 * attribute still in `processing` fails. Poll until every key settles.
 */
async function waitForCollection(collectionId, { label }) {
  // A dry run has written nothing, so there is nothing to wait for — but the
  // caller still needs the live shape to diff against.
  if (DRY_RUN) {
    return databases
      .getCollection({ databaseId: DATABASE_ID, collectionId })
      .catch(() => null);
  }
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const collection = await databases.getCollection({
      databaseId: DATABASE_ID,
      collectionId,
    });
    const pending = [...collection.attributes, ...collection.indexes].filter(
      (item) => item.status === "processing",
    );
    const stuck = [...collection.attributes, ...collection.indexes].filter(
      (item) => item.status === "failed",
    );
    if (stuck.length > 0) {
      console.error(
        `      !! ${label}: failed keys — ${stuck.map((s) => s.key).join(", ")}`,
      );
    }
    if (pending.length === 0) return collection;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  console.error(`      !! ${label}: attributes still processing after 60s`);
  return null;
}

/** Waits for a deleted key to actually disappear, so it can be recreated. */
async function waitForGone(collectionId, key) {
  if (DRY_RUN) return;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const collection = await databases.getCollection({
      databaseId: DATABASE_ID,
      collectionId,
    });
    if (!collection.attributes.some((a) => a.key === key)) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  console.error(`      !! ${key} did not finish deleting`);
}

function createAttribute(collectionId, spec) {
  const base = { databaseId: DATABASE_ID, collectionId, key: spec.key };
  switch (spec.type) {
    case "string":
      return databases.createStringAttribute({
        ...base,
        size: spec.size,
        required: spec.required,
        xdefault: spec.required ? undefined : spec.xdefault,
      });
    case "email":
      return databases.createEmailAttribute({ ...base, required: spec.required });
    case "datetime":
      return databases.createDatetimeAttribute({
        ...base,
        required: spec.required,
      });
    case "boolean":
      return databases.createBooleanAttribute({
        ...base,
        required: spec.required,
      });
    case "enum":
      return databases.createEnumAttribute({
        ...base,
        elements: spec.elements,
        required: spec.required,
      });
    case "relationship":
      return databases.createRelationshipAttribute({
        databaseId: DATABASE_ID,
        collectionId,
        relatedCollectionId: spec.relatedCollectionId,
        type: spec.relationType,
        twoWay: spec.twoWay,
        key: spec.key,
        onDelete: spec.onDelete,
      });
    default:
      throw new Error(`Unhandled spec type: ${spec.type}`);
  }
}

/**
 * Classifies the difference between a live attribute and its spec as either
 * updatable in place or needing a delete-and-recreate.
 *
 * A live attribute that is *larger* than the spec counts as satisfied. Sizes in
 * SPEC are minimums derived from the Zod schemas, and Appwrite can only grow a
 * string attribute, never shrink one — so treating a generous size as drift
 * would mean deleting and recreating nine attributes for no behavioural gain.
 */
function diffAttribute(live, spec) {
  if (liveType(live) !== spec.type) {
    return { kind: "recreate", why: `type ${liveType(live)} → ${spec.type}` };
  }

  const changes = [];

  if (spec.type === "relationship") {
    if (
      live.relatedCollection !== spec.relatedCollectionId ||
      live.relationType !== spec.relationType ||
      live.twoWay !== spec.twoWay
    ) {
      return { kind: "recreate", why: "relationship shape" };
    }
    return null;
  }

  if (spec.type === "string" && live.size < spec.size) {
    changes.push(`size ${live.size}→${spec.size}`);
  }
  if (spec.type === "enum") {
    const liveElements = (live.elements ?? []).join("|");
    if (liveElements !== spec.elements.join("|")) {
      changes.push(`elements [${liveElements}]→[${spec.elements.join("|")}]`);
    }
  }
  if (live.required !== spec.required) {
    changes.push(`required ${live.required}→${spec.required}`);
  }

  return changes.length > 0 ? { kind: "update", changes } : null;
}

function updateAttribute(collectionId, spec) {
  const base = {
    databaseId: DATABASE_ID,
    collectionId,
    key: spec.key,
    required: spec.required,
    /*
     * Explicitly null, never undefined. The update endpoints treat `default` as
     * a required body parameter — omitting it (which is what the SDK does for
     * `undefined`) fails with `Missing required parameter: "xdefault"` — while a
     * required attribute may not carry a non-null default. `null` satisfies
     * both. The create endpoints have no such requirement.
     */
    xdefault: spec.required ? null : (spec.xdefault ?? null),
  };
  switch (spec.type) {
    case "string":
      return databases.updateStringAttribute({ ...base, size: spec.size });
    case "email":
      return databases.updateEmailAttribute(base);
    case "datetime":
      return databases.updateDatetimeAttribute(base);
    case "boolean":
      return databases.updateBooleanAttribute(base);
    case "enum":
      return databases.updateEnumAttribute({ ...base, elements: spec.elements });
    default:
      throw new Error(`Cannot update ${spec.type} in place`);
  }
}

async function reconcileAttributes(collectionId, specs, live, label) {
  const byKey = new Map(live.attributes.map((a) => [a.key, a]));

  for (const spec of specs) {
    const current = byKey.get(spec.key);

    if (!current) {
      await apply("create attribute", `${label}.${spec.key}`, () =>
        createAttribute(collectionId, spec),
      );
      continue;
    }

    const difference = diffAttribute(current, spec);
    if (!difference) continue;

    if (difference.kind === "recreate") {
      await apply(
        "recreate attribute",
        `${label}.${spec.key} (${difference.why}) — was ${describeLive(current)}`,
        async () => {
          await databases.deleteAttribute({
            databaseId: DATABASE_ID,
            collectionId,
            key: spec.key,
          });
          await waitForGone(collectionId, spec.key);
          return createAttribute(collectionId, spec);
        },
      );
      continue;
    }

    await apply(
      "update attribute",
      `${label}.${spec.key} ${difference.changes.join(", ")}`,
      () => updateAttribute(collectionId, spec),
    );
  }

  // Anything live that the app never reads. `appointments` is skipped because a
  // two-way relationship would legitimately put it here.
  const specKeys = new Set(specs.map((s) => s.key));
  for (const attr of live.attributes) {
    if (specKeys.has(attr.key)) continue;
    await apply("delete attribute", `${label}.${attr.key} (not in spec)`, () =>
      databases.deleteAttribute({
        databaseId: DATABASE_ID,
        collectionId,
        key: attr.key,
      }),
    );
  }
}

function sameIndex(live, spec) {
  return (
    live.type === spec.type &&
    live.attributes.join(",") === spec.attributes.join(",") &&
    (live.orders ?? []).join(",") === (spec.orders ?? []).join(",")
  );
}

async function reconcileIndexes(collectionId, specs, label) {
  const live = await waitForCollection(collectionId, { label });
  const liveIndexes = live?.indexes ?? [];
  const byKey = new Map(liveIndexes.map((i) => [i.key, i]));

  for (const spec of specs) {
    const current = byKey.get(spec.key);
    if (current && sameIndex(current, spec)) continue;

    if (current) {
      await apply("recreate index", `${label}.${spec.key}`, async () => {
        await databases.deleteIndex({
          databaseId: DATABASE_ID,
          collectionId,
          key: spec.key,
        });
        await new Promise((resolve) => setTimeout(resolve, 1500));
        return databases.createIndex({
          databaseId: DATABASE_ID,
          collectionId,
          key: spec.key,
          type: spec.type,
          attributes: spec.attributes,
          orders: spec.orders,
        });
      });
      continue;
    }

    await apply(
      "create index",
      `${label}.${spec.key} ${spec.type} [${spec.attributes.join(",")}]`,
      () =>
        databases.createIndex({
          databaseId: DATABASE_ID,
          collectionId,
          key: spec.key,
          type: spec.type,
          attributes: spec.attributes,
          orders: spec.orders,
        }),
    );
  }

  const specKeys = new Set(specs.map((s) => s.key));
  for (const index of liveIndexes) {
    if (specKeys.has(index.key)) continue;
    await apply("delete index", `${label}.${index.key} (not in spec)`, () =>
      databases.deleteIndex({
        databaseId: DATABASE_ID,
        collectionId,
        key: index.key,
      }),
    );
  }
}

/**
 * Collection permissions must be empty with Document Security off. Every request
 * the app makes goes through the API-key client in lib/data/appwrite/client.ts,
 * and API keys bypass these checks — so a `create("any")` grant here buys the
 * app nothing and exposes the whole collection to anyone holding the project ID.
 */
async function reconcileCollectionSettings(collection, label) {
  const permissions = collection.$permissions ?? [];
  const drift = [];
  if (permissions.length > 0) {
    drift.push(`permissions [${permissions.join(", ")}] → []`);
  }
  if (collection.documentSecurity !== false) {
    drift.push("documentSecurity → false");
  }
  if (drift.length === 0) return;

  await apply(
    "lock down collection",
    `${label}: ${drift.join("; ")}`,
    () =>
      databases.updateCollection({
        databaseId: DATABASE_ID,
        collectionId: collection.$id,
        name: collection.name,
        permissions: [],
        documentSecurity: false,
        enabled: true,
      }),
  );
}

/* ---------------------------------- run ---------------------------------- */

console.log(
  `${DRY_RUN ? "DRY RUN — nothing will be written" : "APPLYING CHANGES"}\n` +
    `endpoint ${NEXT_PUBLIC_ENDPOINT}  project ${PROJECT_ID}\n`,
);

const database = await databases
  .get({ databaseId: DATABASE_ID })
  .catch(() => null);
if (!database) {
  console.error(`Database ${DATABASE_ID} not found, or the key cannot read it.`);
  process.exit(1);
}
console.log(`database: ${database.name} (${database.$id})`);

const collections = [
  {
    id: PATIENT_COLLECTION_ID,
    label: "patient",
    attributes: patientAttributes,
    indexes: patientIndexes,
  },
  {
    id: APPOINTMENT_COLLECTION_ID,
    label: "appointment",
    attributes: appointmentAttributes,
    indexes: appointmentIndexes,
  },
];

// Attributes for both collections first: the appointment relationship needs the
// patient collection to exist, and indexes need their attributes available.
for (const { id, label, attributes } of collections) {
  console.log(`\n=== ${label} (${id}) ===`);
  const live = await databases
    .getCollection({ databaseId: DATABASE_ID, collectionId: id })
    .catch(() => null);
  if (!live) {
    console.error(`  collection ${id} not found — create it, then re-run.`);
    failed += 1;
    continue;
  }
  await reconcileCollectionSettings(live, label);
  await reconcileAttributes(id, attributes, live, label);
}

for (const { id, label, indexes } of collections) {
  console.log(`\n=== ${label} indexes ===`);
  await reconcileIndexes(id, indexes, label);
}

console.log(`\n=== bucket (${NEXT_PUBLIC_BUCKET_ID}) ===`);
const bucket = await storage
  .getBucket({ bucketId: NEXT_PUBLIC_BUCKET_ID })
  .catch(() => null);
if (!bucket) {
  console.error(`  bucket ${NEXT_PUBLIC_BUCKET_ID} not found.`);
  failed += 1;
} else {
  const drift = [];
  if (bucket.maximumFileSize !== bucketSpec.maximumFileSize) {
    drift.push(
      `maxFileSize ${bucket.maximumFileSize}→${bucketSpec.maximumFileSize}`,
    );
  }
  if (
    (bucket.allowedFileExtensions ?? []).join(",") !==
    bucketSpec.allowedFileExtensions.join(",")
  ) {
    drift.push(
      `extensions [${(bucket.allowedFileExtensions ?? []).join(",")}]→` +
        `[${bucketSpec.allowedFileExtensions.join(",")}]`,
    );
  }
  if ((bucket.$permissions ?? []).join(",") !== bucketSpec.permissions.join(",")) {
    drift.push(
      `permissions [${(bucket.$permissions ?? []).join(",")}]→` +
        `[${bucketSpec.permissions.join(",")}]`,
    );
  }
  if (bucket.fileSecurity !== bucketSpec.fileSecurity) {
    drift.push(`fileSecurity ${bucket.fileSecurity}→${bucketSpec.fileSecurity}`);
  }

  if (drift.length === 0) {
    console.log("  already matches spec");
  } else {
    await apply("update bucket", drift.join("; "), () =>
      storage.updateBucket({
        bucketId: NEXT_PUBLIC_BUCKET_ID,
        name: bucket.name,
        enabled: true,
        ...bucketSpec,
      }),
    );
  }
}

if (!DRY_RUN) {
  for (const { id, label } of collections) {
    await waitForCollection(id, { label });
  }
}

if (plan.length === 0) {
  console.log("\nAlready in sync — nothing to do.");
} else if (DRY_RUN) {
  console.log(
    `\n${plan.length} change(s) planned. Re-run without --dry-run to apply.`,
  );
} else {
  console.log(
    `\n${plan.length} change(s) — ${applied} applied, ${failed} failed.`,
  );
}

process.exit(failed > 0 ? 1 : 0);
