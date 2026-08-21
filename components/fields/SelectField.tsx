"use client";

import type { ReactNode } from "react";

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
  children: ReactNode;
}

export function SelectField({
  value,
  onChange,
  placeholder,
  disabled,
  children,
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
        <SelectTrigger className="shad-select-trigger">
          <SelectValue placeholder={placeholder ?? "Select an option"} />
        </SelectTrigger>
      </FormControl>
      <SelectContent className="shad-select-content">{children}</SelectContent>
    </Select>
  );
}
