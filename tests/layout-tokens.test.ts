import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { expect, it } from "vitest";

/**
 * Arbitrary-value ratchet.
 *
 * The layout read as machine-generated because it was built from 31 one-off
 * bracket values — `px-[5%]` gutters that align to nothing, `max-w-[860px]`
 * caps invented per page. This test makes that a build failure rather than
 * something a human has to notice in review.
 *
 * ALLOWLIST is a ratchet, not an exemption list: entries may be deleted, never
 * added. It reaches {} at the end of the layout refactor and is removed with
 * this comment.
 */
const ROOTS = ["app", "components", "constants"];
const EXTENSIONS = new Set([".ts", ".tsx", ".css"]);

/**
 * Layout-affecting utilities only. `bg-[url(…)]` and `data-[state=open]` are
 * deliberately not matched — the former is a legitimate asset reference, the
 * latter is Radix state targeting, and neither is a layout magic number.
 *
 * The lookbehind prevents mid-word matches: without it `shadow-[0_0_10px_red]`
 * matches as `w-[0_0_10px_red]`. Same hazard for `overflow-`, `flow-`, `grow-`
 * — any utility ending in a tracked letter.
 *
 * `var(…)` is excluded categorically, not because of any one component: a
 * bracket containing a custom property holds no number, so it is not a magic
 * layout value at all. Radix injects --radix-select-trigger-height and friends
 * at runtime on select, popover, dropdown and tooltip, and no @theme token can
 * express "whatever the trigger measured". Scoping this to one file would mean
 * every future legitimate use forces an ALLOWLIST *addition*, which is the one
 * thing the ratchet forbids. The tradeoff is real and accepted: someone could
 * hide a hardcoded value behind a custom property. That costs them more effort
 * than using a token, so it is not a path anyone takes by accident.
 */
const ARBITRARY =
  /(?<![\w-])(?:max-w|min-w|max-h|min-h|grid-cols|grid-rows|space-x|space-y|gap-x|gap-y|px|py|pt|pb|pl|pr|gap|w|h)-\[(?!var\()[^\]]+\]/g;

/** Known violations awaiting the refactor. Delete entries; never add. */
const ALLOWLIST: Record<string, number> = {
  /**
   * Permanent exemption, not a pending fix. A dialog capping at 92% of the
   * viewport is expressing "fit the screen", not a layout magic number, and
   * Tailwind's rem-based scale has no equivalent step.
   */
  "components/ui/dialog.tsx": 1,
  "components/ui/select.tsx": 1,
  "components/ui/textarea.tsx": 1,
};

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (EXTENSIONS.has(path.extname(entry))) {
      out.push(full);
    }
  }
  return out;
}

function countViolations() {
  const counts: Record<string, number> = {};
  for (const root of ROOTS) {
    for (const file of walk(path.resolve(import.meta.dirname, "..", root))) {
      const matches = readFileSync(file, "utf8").match(ARBITRARY);
      if (!matches) continue;
      // POSIX-style key so the allowlist is identical on Windows and CI.
      const key = path
        .relative(path.resolve(import.meta.dirname, ".."), file)
        .replaceAll("\\", "/");
      counts[key] = matches.length;
    }
  }
  return counts;
}

it("does not add arbitrary layout values beyond the known ratchet", () => {
  const actual = countViolations();

  const unexpected: string[] = [];
  for (const [file, count] of Object.entries(actual)) {
    const allowed = ALLOWLIST[file] ?? 0;
    if (count > allowed) {
      unexpected.push(`${file}: ${count} found, ${allowed} allowed`);
    }
  }

  expect(
    unexpected,
    `New arbitrary layout values. Use a @theme token or an on-scale utility.\n${unexpected.join("\n")}`,
  ).toEqual([]);
});

it("has no stale allowlist entries", () => {
  const actual = countViolations();
  const stale = Object.keys(ALLOWLIST).filter(
    (file) => (actual[file] ?? 0) < (ALLOWLIST[file] ?? 0),
  );

  // Forces the ratchet down: fix a file and you must also shrink its entry.
  expect(stale, `Allowlist is stale — lower or delete: ${stale.join(", ")}`).toEqual(
    [],
  );
});
