import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { toast } from "sonner";

import type { ActionResult } from "@/lib/actions/result";

/**
 * Only the capability actually needed.
 *
 * Taking the whole `UseFormReturn` would drag in react-hook-form's three
 * generics (`TFieldValues`, `TContext`, `TTransformedValues`), and `useForm`
 * infers the third differently depending on the resolver — so a concrete form
 * would not be assignable. Depending on `setError` alone sidesteps that
 * entirely.
 */
interface SettableForm<T extends FieldValues> {
  setError: UseFormSetError<T>;
}

/**
 * Routes a failed `ActionResult` to the right place in the UI.
 *
 * Field-level problems land on the offending inputs via `setError`, so the user
 * sees them where they can fix them. Anything without a field mapping becomes a
 * toast. Without this, server validation failures were invisible: the original
 * code's only handler was `console.log(error)`.
 */
export function applyServerErrors<T extends FieldValues>(
  form: SettableForm<T>,
  result: Extract<ActionResult<unknown>, { ok: false }>,
): void {
  const { fieldErrors, message } = result.error;

  if (fieldErrors && Object.keys(fieldErrors).length > 0) {
    let focused = false;
    for (const [name, error] of Object.entries(fieldErrors)) {
      form.setError(
        name as Path<T>,
        { type: "server", message: error },
        // Move focus to the first offending field so keyboard and screen-reader
        // users are taken to the problem rather than left at the button.
        { shouldFocus: !focused },
      );
      focused = true;
    }
    return;
  }

  toast.error(message);
}

/** Success toast with consistent copy. */
export function toastSuccess(message: string) {
  toast.success(message);
}
