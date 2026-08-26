"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  FieldValues,
  UseFormGetValues,
  UseFormReset,
  UseFormWatch,
} from "react-hook-form";

const TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Fields deliberately excluded from the saved draft.
 *
 * An identification number is exactly the sort of thing that should not sit in
 * localStorage on a shared machine, and a File cannot be serialised anyway.
 * Saving a long health form is a convenience; persisting identity documents to
 * disk is a liability.
 */
const EXCLUDED = new Set([
  "identificationNumber",
  "identificationDocument",
]);

export interface FormDraft {
  /** True once a saved draft has been written this session. */
  saved: boolean;
  restored: boolean;
  clear: () => void;
  discard: () => void;
}

/**
 * Only the four capabilities this hook uses.
 *
 * Accepting the whole `UseFormReturn` would pull in react-hook-form's
 * `TTransformedValues` generic, which `useForm` infers from the resolver — so a
 * concrete form would not be assignable to `UseFormReturn<T>`.
 */
interface DraftableForm<T extends FieldValues> {
  watch: UseFormWatch<T>;
  reset: UseFormReset<T>;
  getValues: UseFormGetValues<T>;
}

export function useFormDraft<T extends FieldValues>(
  form: DraftableForm<T>,
  key: string,
): FormDraft {
  const storageKey = `carepulse:draft:${key}`;
  const [saved, setSaved] = useState(false);
  const [restored, setRestored] = useState(false);
  const hasRestored = useRef(false);

  // Shared with the debounced-save effect below, so `clear()` can cancel a
  // write that is still pending — see the comment on `clear` itself.
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const clear = useCallback(() => {
    // The debounce timer lives in a different effect's closure (below), on a
    // schedule independent of anything that calls `clear()`. Without this,
    // submitting within 800ms of the last keystroke let the pending write
    // land *after* `removeItem`, silently resurrecting the full draft —
    // including health data — in localStorage on a machine the user has just
    // been redirected away from.
    clearTimeout(saveTimerRef.current);
    window.localStorage.removeItem(storageKey);
    setSaved(false);
  }, [storageKey]);

  // Restore once on mount.
  useEffect(() => {
    if (hasRestored.current) return;
    hasRestored.current = true;

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;

      const parsed = JSON.parse(raw) as { at: number; values: Partial<T> };
      if (Date.now() - parsed.at > TTL_MS) {
        window.localStorage.removeItem(storageKey);
        return;
      }

      // `JSON.stringify` cannot round-trip a `Date` — it serialises to an
      // ISO string, and `JSON.parse` hands that string straight back
      // unchanged. Every other field this form saves is already a string (or
      // boolean, or array of strings), so a string draft value matches its
      // schema type as-is; `birthDate` is the one field whose schema is
      // `z.date()`, so a plain restore leaves a value that *looks* answered
      // (`DateField`'s `parseDate` happily renders a string) but fails
      // validation the moment "Continue" tries to move past it. Reviving just
      // this one named field — rather than a generic "does this string look
      // like a date" check applied to every value — keeps the fix scoped to
      // the actual serialisation gap instead of risking a false-positive
      // revive on some unrelated string field a future form might save.
      const values = { ...parsed.values } as Record<string, unknown>;
      if (typeof values.birthDate === "string") {
        const revived = new Date(values.birthDate);
        if (!Number.isNaN(revived.getTime())) values.birthDate = revived;
      }

      // `keepDefaultValues` preserves the server-provided name/email/phone,
      // which should win over anything stale in the draft.
      form.reset(
        { ...form.getValues(), ...(values as Partial<T>) },
        { keepDefaultValues: true },
      );
      setRestored(true);
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, [form, storageKey]);

  // Debounced save.
  useEffect(() => {
    const subscription = form.watch((values) => {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        try {
          const safe = Object.fromEntries(
            Object.entries(values as Record<string, unknown>).filter(
              ([field]) => !EXCLUDED.has(field),
            ),
          );
          window.localStorage.setItem(
            storageKey,
            JSON.stringify({ at: Date.now(), values: safe }),
          );
          setSaved(true);
        } catch {
          // Quota exceeded or storage disabled — a lost draft is not worth
          // interrupting the user over.
        }
      }, 800);
    });

    return () => {
      clearTimeout(saveTimerRef.current);
      subscription.unsubscribe();
    };
  }, [form, storageKey]);

  const discard = useCallback(() => {
    setRestored(false);
    // `clear()` runs *after* `reset()`, not before. `reset()` notifies the
    // watch subscriber below, which schedules a fresh 800ms write — so
    // clearing first left that write to land on an empty key and bring the
    // notice straight back as "Draft saved locally", now holding the default
    // values. Clearing last cancels the timer the reset just scheduled.
    form.reset();
    clear();
  }, [clear, form]);

  return { saved, restored, clear, discard };
}

/** Small inline notice so draft-saving is visible rather than magic. */
export function FormDraftNotice({ draft }: { draft: FormDraft }) {
  if (!draft.saved && !draft.restored) return null;

  return (
    <p className="text-12-regular flex items-center gap-2 text-muted-foreground">
      {draft.restored ? "Restored an unsaved draft." : "Draft saved locally."}
      <button
        type="button"
        onClick={draft.discard}
        className="text-brand underline hover:no-underline"
      >
        Discard
      </button>
    </p>
  );
}
