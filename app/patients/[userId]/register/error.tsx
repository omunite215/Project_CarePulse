"use client";

import { ErrorState } from "@/components/states/ErrorState";

export default function RegisterError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main
      id="main"
      className="page-shell flex min-h-dvh items-center justify-center"
    >
      <div className="w-full max-w-xl">
        <ErrorState
          title="We could not load your registration"
          description="Your details are safe. Try again, or start over from the beginning."
          onRetry={reset}
          detail={error.message}
        />
      </div>
    </main>
  );
}
