import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, it } from "vitest";

/**
 * The admin table and its mobile card render the same `Appointment` rows,
 * but from two independent files with no shared source of field truth:
 * `components/table/columns.tsx` is the single source of *column* truth, and
 * `components/table/AppointmentRowCard.tsx` reads `row.original` directly.
 * Adding a column adds nothing to the card, and nothing told anyone.
 *
 * This is a data-level check, not a rendered one: it pulls the
 * `row.original.<field>` / `appointment.<field>` accesses straight out of
 * both files' source text — the same static-analysis idiom as
 * layout-tokens.test.ts — and asserts the columns' field set is a subset of
 * the card's. That catches "a column reads a field the card never touches",
 * which is the actual drift this guards against, without rendering either
 * component: `columns.tsx` cells receive a bespoke `{ row }` shape from
 * TanStack Table (not a real table instance), and several cells pull in
 * `AppointmentModal`, which needs router and query-client context that isn't
 * worth stubbing just to read some JSX back out.
 *
 * Known blind spot, stated plainly: a field that only reaches a component by
 * riding along inside a whole-object prop — both files do
 * `appointment={appointment}` into `AppointmentModal` — is invisible here,
 * since it is never written as its own `.field` access in either file. That
 * is fine for this pair today, because both the table and the card hand the
 * same modal the same whole object; it would stop being fine the day only
 * one of them did.
 */
const ROOT = path.resolve(import.meta.dirname, "..");
const COLUMNS_FILE = path.join(ROOT, "components/table/columns.tsx");
const CARD_FILE = path.join(ROOT, "components/table/AppointmentRowCard.tsx");

/**
 * Matches `row.original.foo`, `row.original.foo.bar`, and the `appointment.*`
 * spelling both files fall back to once they've pulled `row.original` (or
 * the card's own prop) into a local named `appointment`. One extra path
 * segment is enough to tell `patient.name` apart from bare `patient`.
 */
const FIELD_ACCESS =
  /(?:row\.original|appointment)\.([a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)?)/g;

function fieldsReadBy(file: string): Set<string> {
  const source = readFileSync(file, "utf8");
  const fields = new Set<string>();
  for (const match of source.matchAll(FIELD_ACCESS)) {
    const field = match[1];
    if (field) fields.add(field);
  }
  return fields;
}

it("every Appointment field the table columns read is also read by the mobile card", () => {
  const columnFields = fieldsReadBy(COLUMNS_FILE);
  const cardFields = fieldsReadBy(CARD_FILE);

  const missing = [...columnFields]
    .filter((field) => !cardFields.has(field))
    .toSorted();

  expect(
    missing,
    `columns.tsx reads these Appointment fields but AppointmentRowCard.tsx ` +
      `does not: ${missing.join(", ")}. Add the field to the card too, or ` +
      `the table and the card have drifted.`,
  ).toEqual([]);
});
