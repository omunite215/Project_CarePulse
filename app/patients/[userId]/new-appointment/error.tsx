"use client";

import { ErrorState } from "@/components/states/ErrorState";

export default function NewAppointmentError({
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
          title="We could not open the booking form"
          description="No appointment has been created. Try again in a moment."
          onRetry={reset}
          detail={error.message}
        />
      </div>
    </main>
  );
}
