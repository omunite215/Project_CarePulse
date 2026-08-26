// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useFormDraft } from "@/components/forms/useFormDraft";

/**
 * A minimal stand-in for `useFormDraft`'s (unexported) `DraftableForm<T>`
 * interface — exactly the three methods the hook actually calls, plus a
 * handle for the test to drive `watch`'s subscriber directly. Real
 * `useForm()` machinery (resolvers, field registration) is irrelevant to
 * what these two findings are about: the JSON round-trip in the restore
 * effect (I-5), and the debounce timer in the save effect racing `clear()`
 * (M-1).
 *
 * Cast once at the boundary, rather than typed directly against
 * `useFormDraft`'s parameter: RHF's real `watch`/`reset`/`getValues` types
 * are each multi-overload signatures (watch everything, watch one field,
 * watch a list; reset with options; …) that a single-shape stand-in cannot
 * structurally satisfy field-by-field, even though it correctly implements
 * the one overload of each `useFormDraft` actually calls.
 */
function createFakeForm(initial: Record<string, unknown>) {
  let listener: ((values: Record<string, unknown>) => void) | null = null;
  const reset = vi.fn();

  const rawForm = {
    watch: (callback: (values: Record<string, unknown>) => void) => {
      listener = callback;
      return { unsubscribe: () => (listener = null) };
    },
    reset,
    getValues: () => initial,
  };

  return {
    form: rawForm as unknown as Parameters<
      typeof useFormDraft<Record<string, unknown>>
    >[0],
    reset,
    /** Drives the save effect's `form.watch` subscriber directly. */
    emit: (values: Record<string, unknown>) => listener?.(values),
  };
}

describe("useFormDraft — reviving a restored birthDate (I-5)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("turns a serialised birthDate ISO string back into a real Date before form.reset", () => {
    const isoBirthDate = "1991-04-18T00:00:00.000Z";
    window.localStorage.setItem(
      "carepulse:draft:birthdate-test",
      JSON.stringify({
        at: Date.now(),
        values: { name: "Ada", birthDate: isoBirthDate },
      }),
    );

    const { form, reset } = createFakeForm({ name: "", birthDate: undefined });
    renderHook(() => useFormDraft(form, "birthdate-test"));

    expect(reset).toHaveBeenCalledTimes(1);
    const [resetValues] = reset.mock.calls[0] as [Record<string, unknown>];

    // `z.date()` rejects a string outright — this is the actual bug: a
    // restored draft looked answered (DateField's parseDate renders a
    // string fine) but failed validation the moment "Continue" tried to
    // move past it.
    expect(resetValues.birthDate).toBeInstanceOf(Date);
    expect((resetValues.birthDate as Date).toISOString()).toBe(isoBirthDate);

    // Narrowly scoped to `birthDate`: every other restored field is left
    // exactly as `JSON.parse` produced it, not run through a generic
    // date-detecting reviver that might reinterpret an unrelated field.
    expect(resetValues.name).toBe("Ada");
  });

  it("leaves an unparsable birthDate string alone rather than writing an Invalid Date", () => {
    window.localStorage.setItem(
      "carepulse:draft:birthdate-garbage-test",
      JSON.stringify({
        at: Date.now(),
        values: { birthDate: "not a date" },
      }),
    );

    const { form, reset } = createFakeForm({ birthDate: undefined });
    renderHook(() => useFormDraft(form, "birthdate-garbage-test"));

    const [resetValues] = reset.mock.calls[0] as [Record<string, unknown>];
    expect(resetValues.birthDate).toBe("not a date");
  });
});

describe("draft.clear() cancels a pending debounced save (M-1)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("does not let an in-flight 800ms write land after clear()", () => {
    vi.useFakeTimers();
    try {
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
      const { form, emit } = createFakeForm({ name: "" });
      const { result } = renderHook(() =>
        useFormDraft(form, "clear-race-test"),
      );

      // A keystroke: schedules the 800ms debounced write.
      act(() => emit({ name: "Jane" }));

      // Submitting within the debounce window: clear() must cancel the
      // pending timer, not just remove whatever is in storage right now.
      act(() => result.current.clear());
      act(() => vi.advanceTimersByTime(1000));

      expect(setItemSpy).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

/**
 * Driven by a real `useForm`, not `createFakeForm`.
 *
 * The stand-in above has `reset` as a bare `vi.fn()` that never notifies the
 * `watch` subscriber, and this bug is precisely that real RHF's `reset()`
 * *does* notify it — so a mock faithful enough to catch this would be a mock
 * asserting the thing under test.
 */
function renderRealDraft() {
  return renderHook(() => {
    const form = useForm({ defaultValues: { name: "", email: "" } });
    return { form, draft: useFormDraft(form, "discard-test") };
  });
}

describe("draft.discard() does not resurrect the draft it just cleared", () => {
  const KEY = "carepulse:draft:discard-test";

  beforeEach(() => {
    window.localStorage.clear();
  });

  it("leaves storage empty and the notice hidden after the debounce elapses", () => {
    vi.useFakeTimers();
    try {
      const { result } = renderRealDraft();

      // Type something and let the 800ms debounce land, so there is a real
      // draft to discard and the notice is on screen.
      act(() => result.current.form.setValue("name", "Jane"));
      act(() => vi.advanceTimersByTime(1000));

      expect(window.localStorage.getItem(KEY)).not.toBeNull();
      expect(result.current.draft.saved).toBe(true);

      // Discard, then let any timer that `reset()` scheduled run out.
      act(() => result.current.draft.discard());
      act(() => vi.advanceTimersByTime(1000));

      expect(window.localStorage.getItem(KEY)).toBeNull();
      expect(result.current.draft.saved).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("still saves normally when the user types again after discarding", () => {
    vi.useFakeTimers();
    try {
      const { result } = renderRealDraft();

      act(() => result.current.draft.discard());
      act(() => vi.advanceTimersByTime(1000));
      expect(window.localStorage.getItem(KEY)).toBeNull();

      // Discard must suppress the reset's own write, not permanently disable
      // saving for the rest of the session.
      act(() => result.current.form.setValue("name", "Ada"));
      act(() => vi.advanceTimersByTime(1000));

      expect(window.localStorage.getItem(KEY)).not.toBeNull();
      expect(result.current.draft.saved).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
