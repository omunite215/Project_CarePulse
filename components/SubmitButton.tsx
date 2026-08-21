"use client";

import Image from "next/image";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SubmitButtonProps {
  isLoading: boolean;
  className?: string;
  children: ReactNode;
  /** Announced and shown while submitting. Defaults to "Working…". */
  loadingLabel?: string;
}

/**
 * The original dropped `children` entirely while loading, so the button's label
 * vanished and was replaced by a bare spinner — the user lost all context about
 * what was in flight. Here the label stays and the spinner joins it.
 */
export default function SubmitButton({
  isLoading,
  className,
  children,
  loadingLabel,
}: SubmitButtonProps) {
  return (
    <Button
      type="submit"
      disabled={isLoading}
      aria-busy={isLoading}
      className={cn("shad-primary-btn w-full", className)}
    >
      {isLoading ? (
        <span className="flex items-center justify-center gap-3">
          <Image
            src="/assets/icons/loader.svg"
            alt=""
            aria-hidden="true"
            width={20}
            height={20}
            className="animate-spin"
          />
          {loadingLabel ?? children}
        </span>
      ) : (
        children
      )}
    </Button>
  );
}
