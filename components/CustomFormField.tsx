"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import type {
  Control,
  ControllerRenderProps,
  FieldPath,
  FieldValues,
} from "react-hook-form";
import PhoneInput, { type Value as PhoneValue } from "react-phone-number-input";
import "react-phone-number-input/style.css";

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DateField } from "@/components/fields/DateField";
import { SelectField } from "@/components/fields/SelectField";
import { FormFieldType } from "@/components/forms/field-types";
import { useFieldRequired } from "@/components/forms/FieldRequirements";
import { cn } from "@/lib/utils";

/**
 * The form field renderer.
 *
 * Rewritten from a version whose `switch` handled only INPUT and PHONE_INPUT
 * with no `default`, so TEXTAREA, CHECKBOX, DATE_PICKER, SELECT and SKELETON
 * each returned `undefined` and rendered nothing at all, silently. That is the
 * single reason the registration form could never be built out.
 *
 * Two deliberate design choices:
 *
 * 1. **Generic over the form's field values.** `Control<TFieldValues>` is
 *    invariant, so a flat `Control<FieldValues>` prop rejects every concrete
 *    form. Threading the generic also makes `name` autocomplete against the
 *    real field names instead of accepting any string.
 *
 * 2. **Discriminated union on `fieldType`.** The old props were one flat bag of
 *    optionals that accepted `dateFormat` on a checkbox and `showTimeSelect` on
 *    a select, and consumed neither.
 */

interface BaseProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
  /**
   * Override the schema-derived requirement. Only needed for forms whose
   * fields are not covered by a `<FieldRequirements>` provider; the register
   * form should never pass this, because a hand-set value can disagree with
   * the validation it wraps itself in.
   */
  required?: boolean;
}

type FieldProps<T extends FieldValues> =
  | (BaseProps<T> & {
      fieldType: typeof FormFieldType.INPUT;
      placeholder?: string;
      iconSrc?: string;
      iconAlt?: string;
      inputMode?: "text" | "email" | "tel" | "numeric";
      type?: "text" | "email" | "password";
    })
  | (BaseProps<T> & {
      fieldType: typeof FormFieldType.TEXTAREA;
      placeholder?: string;
      rows?: number;
      maxLength?: number;
    })
  | (BaseProps<T> & {
      fieldType: typeof FormFieldType.PHONE_INPUT;
      placeholder?: string;
    })
  | (BaseProps<T> & {
      fieldType: typeof FormFieldType.CHECKBOX;
      /** Checkboxes carry their copy beside the box, not above it. */
      checkboxLabel: ReactNode;
    })
  | (BaseProps<T> & {
      fieldType: typeof FormFieldType.DATE_PICKER;
      placeholder?: string;
      /** Adds a time-slot grid beneath the calendar. */
      showTimeSelect?: boolean;
      /** Whose diary to check for taken slots. */
      physician?: string;
      fromDate?: Date;
      toDate?: Date;
      variant?: "default" | "birthdate";
    })
  | (BaseProps<T> & {
      fieldType: typeof FormFieldType.SELECT;
      placeholder?: string;
      children: ReactNode;
    })
  | (BaseProps<T> & {
      fieldType: typeof FormFieldType.SKELETON;
      renderSkeleton: (
        field: ControllerRenderProps<T, FieldPath<T>>,
      ) => ReactNode;
    });

function RenderField<T extends FieldValues>({
  field,
  props,
  required,
}: {
  field: ControllerRenderProps<T, FieldPath<T>>;
  props: FieldProps<T>;
  required: boolean;
}) {
  switch (props.fieldType) {
    case FormFieldType.INPUT:
      return (
        <div className="flex items-center rounded-md border border-border bg-surface">
          {props.iconSrc ? (
            <Image
              src={props.iconSrc}
              height={24}
              width={24}
              // Decorative: the visible <FormLabel> already names the field, so
              // an empty alt keeps these out of the accessibility tree.
              alt={props.iconAlt ?? ""}
              aria-hidden={props.iconAlt ? undefined : true}
              className="ml-2"
            />
          ) : null}
          <FormControl>
            <Input
              placeholder={props.placeholder}
              type={props.type ?? "text"}
              inputMode={props.inputMode}
              disabled={props.disabled}
              className="shad-input border-0"
              {...field}
              value={field.value ?? ""}
              aria-required={required || undefined}
            />
          </FormControl>
        </div>
      );

    case FormFieldType.TEXTAREA: {
      const value = typeof field.value === "string" ? field.value : "";
      const max = props.maxLength;
      const nearLimit = max !== undefined && value.length > max * 0.9;

      return (
        <>
          <FormControl>
            <Textarea
              placeholder={props.placeholder}
              rows={props.rows ?? 4}
              disabled={props.disabled}
              maxLength={max}
              aria-required={required || undefined}
              className="shad-textArea"
              {...field}
              value={value}
            />
          </FormControl>
          {max !== undefined ? (
            /* aria-hidden deliberately: a live region here announces the count
               on every keystroke. The limit is stated once in the field's
               description, which aria-describedby already links. */
            <p
              aria-hidden="true"
              className={cn(
                "text-12-regular text-right tabular-nums",
                nearLimit ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {value.length} / {max}
            </p>
          ) : null}
        </>
      );
    }

    case FormFieldType.PHONE_INPUT:
      return (
        <FormControl>
          <PhoneInput
            defaultCountry="US"
            international
            withCountryCallingCode
            placeholder={props.placeholder}
            disabled={props.disabled}
            value={field.value as PhoneValue | undefined}
            onChange={field.onChange}
            className="input-phone"
            aria-required={required || undefined}
          />
        </FormControl>
      );

    case FormFieldType.CHECKBOX:
      return (
        <FormControl>
          <div className="flex items-start gap-3">
            <Checkbox
              id={props.name}
              checked={Boolean(field.value)}
              onCheckedChange={field.onChange}
              disabled={props.disabled}
              className="mt-0.5"
              aria-required={required || undefined}
            />
            <label htmlFor={props.name} className="checkbox-label">
              {props.checkboxLabel}
            </label>
          </div>
        </FormControl>
      );

    case FormFieldType.DATE_PICKER:
      return (
        <DateField
          value={field.value as Date | string | undefined}
          onChange={field.onChange}
          placeholder={props.placeholder}
          disabled={props.disabled}
          showTimeSelect={props.showTimeSelect}
          physician={props.physician}
          fromDate={props.fromDate}
          toDate={props.toDate}
          variant={props.variant}
          required={required}
        />
      );

    case FormFieldType.SELECT:
      return (
        <SelectField
          value={field.value as string | undefined}
          onChange={field.onChange}
          placeholder={props.placeholder}
          disabled={props.disabled}
          required={required}
        >
          {props.children}
        </SelectField>
      );

    case FormFieldType.SKELETON:
      return props.renderSkeleton(field);

    default: {
      // Exhaustiveness check: adding a FormFieldType without handling it here
      // fails the build, rather than silently rendering nothing the way the
      // previous version hid five missing branches.
      const exhaustive: never = props;
      if (process.env.NODE_ENV !== "production") {
        throw new Error(
          `CustomFormField: unhandled fieldType ${JSON.stringify(exhaustive)}`,
        );
      }
      return null;
    }
  }
}

export default function CustomFormField<T extends FieldValues>(
  props: FieldProps<T>,
) {
  const { control, name, label, description, fieldType, className } = props;

  // Derived, not passed: an explicit prop on 22 call sites is a second source
  // of truth that can disagree with the schema actually doing the validating.
  // The hook is called unconditionally — `??` must apply to its *result*, not
  // gate the call itself, or this breaks the rules of hooks the moment a
  // caller passes `required` on some renders and not others.
  const derivedRequired = useFieldRequired(name);
  const required = props.required ?? derivedRequired;

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        // No default width class: fields are grid children now, and a
        // leftover `flex-1` would fight an explicit col-span.
        <FormItem className={className}>
          {/* A checkbox is labelled inline, so a heading above it would be a
              second label for the same control. */}
          {label && fieldType !== FormFieldType.CHECKBOX ? (
            <FormLabel className="shad-input-label">
              {label}
              {required ? (
                <>
                  {/* Decorative: announced as "Address star" otherwise. The
                      meaning rides on the sr-only span instead. */}
                  <span aria-hidden="true" className="ml-0.5 text-destructive">
                    *
                  </span>
                  <span className="sr-only"> (required)</span>
                </>
              ) : null}
            </FormLabel>
          ) : null}

          <RenderField field={field} props={props} required={required} />

          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage className="shad-error" />
        </FormItem>
      )}
    />
  );
}

export { FormFieldType };
