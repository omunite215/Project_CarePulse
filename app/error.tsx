"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/states/ErrorState";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // In a deployment with monitoring wired up this is the hook for it. Logging
    // is the minimum: a swallowed error is how the original app hid every
    // failure behind console.log.
    console.error("[route error]", error.digest ?? "", error.message);
  }, [error]);

  return (
    <main
      id="main"
      className="flex min-h-screen items-center justify-center px-[5%]"
    >
      <div className="w-full max-w-xl">
        <ErrorState onRetry={reset} detail={error.message} />
      </div>
    </main>
  );
}
