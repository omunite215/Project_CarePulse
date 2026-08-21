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
}: {
  field: ControllerRenderProps<T, FieldPath<T>>;
  props: FieldProps<T>;
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
            />
          </FormControl>
        </div>
      );

    case FormFieldType.TEXTAREA:
      return (
        <FormControl>
          <Textarea
            placeholder={props.placeholder}
            rows={props.rows ?? 4}
            disabled={props.disabled}
            className="shad-textArea"
            {...field}
            value={field.value ?? ""}
          />
        </FormControl>
      );

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
        />
      );

    case FormFieldType.SELECT:
      return (
        <SelectField
          value={field.value as string | undefined}
          onChange={field.onChange}
          placeholder={props.placeholder}
          disabled={props.disabled}
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

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={cn("flex-1", className)}>
          {/* A checkbox is labelled inline, so a heading above it would be a
              second label for the same control. */}
          {label && fieldType !== FormFieldType.CHECKBOX ? (
            <FormLabel className="shad-input-label">{label}</FormLabel>
          ) : null}

          <RenderField field={field} props={props} />

          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage className="shad-error" />
        </FormItem>
      )}
    />
  );
}

export { FormFieldType };
