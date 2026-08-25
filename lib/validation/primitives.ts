import { z } from "zod";

/** E.164, as produced by react-phone-number-input. */
export const PHONE_PATTERN = /^\+\d{10,15}$/;

export const phoneSchema = z
  .string()
  .refine((value) => PHONE_PATTERN.test(value), {
    error: "Enter a phone number including the country code",
  });

export const personNameSchema = z
  .string()
  .trim()
  .min(2, { error: "Enter the full name" })
  .max(50, { error: "Name must be at most 50 characters" });

export const emailSchema = z.email({
  error: "Enter an email address, like jane@example.com",
});

/**
 * A consent checkbox that must be ticked.
 *
 * Zod 3 spelled this `.boolean().default(false).refine(v => v === true)`. That
 * does not carry over: Zod 4's `.default()` takes the *output* type, so
 * defaulting to `false` and then refusing `false` is self-contradictory — the
 * schema could never be satisfied by an omitted key.
 *
 * The initial value is form state, not a validation concern, so it lives in the
 * form's `defaultValues` instead.
 */
export const consentSchema = (error: string) =>
  z.boolean().refine((value) => value === true, { error });
