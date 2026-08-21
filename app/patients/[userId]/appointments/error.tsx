"use client";

import { ErrorState } from "@/components/states/ErrorState";

export default function AppointmentsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main
      id="main"
      className="flex min-h-screen items-center justify-center px-[5%]"
    >
      <div className="w-full max-w-xl">
        <ErrorState
          title="We could not load your appointments"
          description="Your bookings are safe. Try again in a moment."
          onRetry={reset}
          detail={error.message}
        />
      </div>
    </main>
  );
}
