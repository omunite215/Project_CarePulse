"use client";

import { AlertTriangleIcon, RotateCcwIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  title?: string;
  description?: ReactNode;
  /** Wired to an error boundary's `reset`. */
  onRetry?: () => void;
  /** Shown alongside retry, e.g. a way back to safety. */
  homeHref?: string;
  /** Only rendered outside production. */
  detail?: string;
}

export function ErrorState({
  title = "Something went wrong",
  description = "We hit an unexpected problem. Trying again usually helps.",
  onRetry,
  homeHref = "/",
  detail,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-5 rounded-xl border border-red-500/30 bg-red-600/20 px-6 py-12 text-center"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-red-600">
        <AlertTriangleIcon className="size-6 text-red-500" aria-hidden="true" />
      </span>

      <div className="space-y-2">
        <h2 className="sub-header text-foreground">{title}</h2>
        <p className="text-14-regular max-w-md text-foreground/80">{description}</p>
      </div>

      {/* The underlying message is useful while developing and a liability in
          production, where it can leak internals into a screenshot. */}
      {detail && process.env.NODE_ENV !== "production" ? (
        <pre className="text-12-regular max-w-lg overflow-x-auto rounded-md bg-surface-raised p-3 text-left text-foreground/80">
          {detail}
        </pre>
      ) : null}

      <div className="flex flex-wrap items-center justify-center gap-3">
        {onRetry ? (
          <Button onClick={onRetry} className="shad-primary-btn gap-2">
            <RotateCcwIcon className="size-4" aria-hidden="true" />
            Try again
          </Button>
        ) : null}
        <Button asChild variant="outline" className="shad-gray-btn">
          <Link href={homeHref}>Back to start</Link>
        </Button>
      </div>
    </div>
  );
}
