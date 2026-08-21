"use client";

import { WifiOffIcon } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Tells the user when the network has gone away.
 *
 * Without this, a lost connection presents as a form that silently refuses to
 * submit — indistinguishable from the app being broken.
 */
export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // Read once on mount rather than during render: navigator is unavailable
    // during SSR and would produce a hydration mismatch.
    setIsOffline(!navigator.onLine);

    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    // <output> carries an implicit role="status", so the live region is
    // conveyed by the element itself rather than bolted on with ARIA.
    <output className="text-14-medium fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-red-700 px-4 py-2 text-white">
      <WifiOffIcon className="size-4" aria-hidden="true" />
      You are offline. Changes cannot be saved right now.
    </output>
  );
}
