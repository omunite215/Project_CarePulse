"use client";

import { ErrorState } from "@/components/states/ErrorState";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // An expired or missing admin session surfaces here as an AppError from
  // requireAdmin(). Sending them back through the passkey gate is more useful
  // than a generic retry that will fail identically.
  const isAuth = /authorised|authorized|admin access/i.test(error.message);

  return (
    <main
      id="main"
      className="page-shell flex min-h-dvh items-center justify-center"
    >
      <div className="w-full max-w-xl">
        <ErrorState
          title={isAuth ? "Your admin session has ended" : "Dashboard unavailable"}
          description={
            isAuth
              ? "Sessions last eight hours. Enter the passkey again to continue."
              : "We could not load the dashboard. No appointment data has been changed."
          }
          onRetry={isAuth ? undefined : reset}
          homeHref={isAuth ? "/?admin=true" : "/"}
          detail={error.message}
        />
      </div>
    </main>
  );
}
