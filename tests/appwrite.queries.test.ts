import { Query } from "node-appwrite";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Asserts the queries the Appwrite adapter builds, with no live project.
 *
 * The contract suite in `repository.contract.test.ts` covers behaviour against a
 * real backend, but it cannot catch the count bug: fetching 1000 rows and
 * tallying them in JS gives the right answer until the collection holds more
 * than 1000, and seeding 1001 appointments per test run is not a trade worth
 * making. The defect is in the *query*, so that is what this asserts — offline,
 * so it runs in `pnpm check` without credentials.
 */

const listDocuments = vi.fn();
const getDocument = vi.fn();
const createDocument = vi.fn();
const updateDocument = vi.fn();

const ids = {
  databaseId: "db",
  patientCollectionId: "patient",
  appointmentCollectionId: "appointment",
  bucketId: "bucket",
  endpoint: "https://appwrite.test/v1",
  projectId: "project",
};

vi.mock("@/lib/data/appwrite/client", () => ({
  getAppwrite: () => ({
    databases: { listDocuments, getDocument, createDocument, updateDocument },
    storage: {},
    users: {},
    messaging: {},
    ids,
  }),
  fileViewUrl: (fileId: string) => `${ids.endpoint}/files/${fileId}`,
}));

const { AppwriteRepository } = await import(
  "@/lib/data/appwrite/appwrite.repository"
);

/** Distinct on purpose: a transposed mapping would still pass equal numbers. */
const TOTALS = { pending: 6, scheduled: 8, cancelled: 3 } as const;

/** Every `queries` array the adapter passed to `listDocuments`. */
function calls(): string[][] {
  return listDocuments.mock.calls.map(([params]) => params.queries ?? []);
}

/** The page query is the one with no `status` equality filter. */
function pageQuery(): string[] {
  const found = calls().find(
    (queries) =>
      !Object.keys(TOTALS).some((status) =>
        queries.includes(Query.equal("status", [status])),
      ),
  );
  if (!found) throw new Error("no page query was issued");
  return found;
}

describe("Appwrite adapter query construction", () => {
  beforeEach(() => {
    listDocuments.mockReset();
    listDocuments.mockImplementation(({ queries = [] }) => {
      for (const [status, total] of Object.entries(TOTALS)) {
        if (queries.includes(Query.equal("status", [status]))) {
          // A count query must not be relying on the documents it returns.
          return Promise.resolve({ documents: [], total });
        }
      }
      return Promise.resolve({ documents: [], total: 0 });
    });
  });

  describe("status counts", () => {
    it("reads server-side totals per status", async () => {
      const result = await new AppwriteRepository().listAppointments({
        pageSize: 10,
      });

      expect(result.counts).toEqual({
        scheduledCount: 8,
        pendingCount: 6,
        cancelledCount: 3,
      });
    });

    it("never fetches more rows than the caller asked for", async () => {
      await new AppwriteRepository().listAppointments({ pageSize: 10 });

      // The regression this guards: a `Query.limit(1000)` read that tallies
      // statuses client-side. 1000 is Appwrite's per-request ceiling, so past
      // 1000 appointments the StatCards under-report silently and permanently.
      for (const queries of calls()) {
        const requested = queries.filter((q) => q.includes('"limit"'));
        expect(requested).toHaveLength(1);
        expect(
          requested[0] === Query.limit(10) || requested[0] === Query.limit(1),
        ).toBe(true);
      }
    });

    it("counts the whole clinic regardless of the caller's filters", async () => {
      await new AppwriteRepository().listAppointments({
        status: "cancelled",
        search: "anything",
        from: "2026-01-01T00:00:00.000Z",
        pageSize: 5,
      });

      // The StatCards describe the clinic, not the current search, so a count
      // query carries its own status filter and nothing else.
      for (const status of ["pending", "scheduled", "cancelled"] as const) {
        const countQuery = calls().find(
          (queries) =>
            queries.includes(Query.equal("status", [status])) &&
            queries.includes(Query.limit(1)),
        );
        expect(countQuery, `no count query for ${status}`).toBeDefined();
        expect(countQuery).toEqual([Query.equal("status", [status]), Query.limit(1)]);
      }
    });
  });

  describe("relationship expansion", () => {
    /*
     * Appwrite 1.9 returns `patient` as a bare id string unless the read selects
     * it, and the mapper then degrades to a placeholder — a blank Patient column
     * rather than a thrown error. Asserting the query is the only cheap way to
     * catch a read path that forgets.
     */
    const SELECT_PATIENT = Query.select(["*", "patient.*"]);

    it("selects the related patient when listing", async () => {
      await new AppwriteRepository().listAppointments({});
      expect(pageQuery()).toContain(SELECT_PATIENT);
    });

    it("selects the related patient when listing one user's appointments", async () => {
      await new AppwriteRepository().listAppointmentsByUser("user-1");
      expect(pageQuery()).toContain(SELECT_PATIENT);
    });

    it("selects the related patient when fetching one appointment", async () => {
      getDocument.mockResolvedValue({ $id: "a1", $createdAt: "", patient: null });

      await new AppwriteRepository().getAppointment("a1");

      expect(getDocument.mock.calls[0]![0].queries).toContain(SELECT_PATIENT);
    });

    it("does not select the patient for a slot lookup, which never reads one", async () => {
      await new AppwriteRepository().getBookedSlots("John Green", "2026-09-01");
      expect(pageQuery()).not.toContain(SELECT_PATIENT);
    });
  });

  describe("search", () => {
    it("searches the denormalised blob, not the doctor alone", async () => {
      await new AppwriteRepository().listAppointments({ search: "Aaltonen" });

      expect(pageQuery()).toContain(Query.search("searchText", "Aaltonen"));
      expect(pageQuery()).not.toContain(
        Query.search("primaryPhysician", "Aaltonen"),
      );
    });

    it("ignores a whitespace-only term, as the demo matcher does", async () => {
      await new AppwriteRepository().listAppointments({ search: "   " });

      expect(pageQuery().some((q) => q.includes('"search"'))).toBe(false);
    });
  });

  describe("sort", () => {
    it("orders by the denormalised patient name for sort=patient", async () => {
      await new AppwriteRepository().listAppointments({
        sort: "patient",
        direction: "asc",
      });

      expect(pageQuery()).toContain(Query.orderAsc("patientName"));
    });

    it("orders by schedule for sort=schedule", async () => {
      await new AppwriteRepository().listAppointments({
        sort: "schedule",
        direction: "desc",
      });

      expect(pageQuery()).toContain(Query.orderDesc("schedule"));
    });

    it("falls back to creation date for sort=createdAt", async () => {
      await new AppwriteRepository().listAppointments({ sort: "createdAt" });

      expect(pageQuery()).toContain(Query.orderDesc("$createdAt"));
    });
  });
});
