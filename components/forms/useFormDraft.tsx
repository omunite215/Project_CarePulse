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

  const clear = useCallback(() => {
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

      // `keepDefaultValues` preserves the server-provided name/email/phone,
      // which should win over anything stale in the draft.
      form.reset(
        { ...form.getValues(), ...parsed.values },
        { keepDefaultValues: true },
      );
      setRestored(true);
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, [form, storageKey]);

  // Debounced save.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const subscription = form.watch((values) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
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
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, [form, storageKey]);

  const discard = useCallback(() => {
    clear();
    setRestored(false);
    form.reset();
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
