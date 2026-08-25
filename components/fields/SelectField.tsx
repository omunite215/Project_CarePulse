"use client";

import type { ReactNode, Ref } from "react";

import { FormControl } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SelectFieldProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  children: ReactNode;
  /**
   * Forwarded from react-hook-form's field so `form.setFocus(name)` has
   * something to call `.focus()` on. The trigger is the only element a
   * select field ever holds keyboard focus on — the listbox is portalled
   * and only exists while open — so that is what the ref has to land on.
   */
  ref?: Ref<HTMLButtonElement>;
}

export function SelectField({
  value,
  onChange,
  placeholder,
  disabled,
  required,
  children,
  ref,
}: SelectFieldProps) {
  return (
    // Radix Select treats "" as "no value", so an empty default renders the
    // placeholder rather than a blank selected row.
    <Select
      value={value || undefined}
      onValueChange={onChange}
      disabled={disabled}
    >
      <FormControl>
        <SelectTrigger
          ref={ref}
          className="shad-select-trigger"
          aria-required={required || undefined}
        >
          <SelectValue placeholder={placeholder ?? "Select an option"} />
        </SelectTrigger>
      </FormControl>
      <SelectContent className="shad-select-content">{children}</SelectContent>
    </Select>
  );
}
