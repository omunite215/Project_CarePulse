"use client";

import { XIcon } from "lucide-react";
import { m } from "motion/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import { verifyAdminPasskey } from "@/lib/actions/admin.actions";

/**
 * Admin passkey gate.
 *
 * The UX matches the reference — a six-digit OTP dialog — but the mechanism is
 * completely different. The reference compared `NEXT_PUBLIC_ADMIN_PASSKEY` in
 * the browser and stored `btoa(passkey)` in localStorage, so the secret was in
 * the JS bundle and the gate could be walked past from devtools.
 *
 * Here the code goes to a Server Action, is compared in constant time against a
 * server-only variable, and is exchanged for a signed httpOnly cookie that
 * `proxy.ts` checks. There is nothing in the client to tamper with.
 */
export function PasskeyModal() {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [passkey, setPasskey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [isPending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    router.push("/");
  }

  function submit() {
    setError(null);

    startTransition(async () => {
      const result = await verifyAdminPasskey({ passkey });

      if (result.ok) {
        setOpen(false);
        router.replace("/admin");
        return;
      }

      setError(result.error.fieldErrors?.passkey ?? result.error.message);
      setPasskey("");
      // Bumping the key restarts the shake animation even on consecutive
      // failures with the same message.
      setShakeKey((n) => n + 1);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent className="shad-alert-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-start justify-between gap-4">
            Admin access
            <button
              type="button"
              onClick={close}
              aria-label="Close and return home"
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <XIcon className="size-4" aria-hidden="true" />
            </button>
          </AlertDialogTitle>
          <AlertDialogDescription>
            Enter the six-digit passkey to open the admin dashboard.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <m.div
          key={shakeKey}
          animate={error ? { x: [0, -6, 6, -4, 4, 0] } : undefined}
          transition={{ duration: 0.4 }}
        >
          <InputOTP
            maxLength={6}
            value={passkey}
            onChange={setPasskey}
            disabled={isPending}
            autoFocus
            onComplete={submit}
          >
            <InputOTPGroup className="shad-otp">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <InputOTPSlot
                  key={index}
                  index={index}
                  className="shad-otp-slot"
                />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </m.div>

        {error ? (
          <p
            role="alert"
            aria-live="assertive"
            className="shad-error text-14-regular flex justify-center"
          >
            {error}
          </p>
        ) : null}

        <Button
          onClick={submit}
          disabled={passkey.length !== 6 || isPending}
          className="shad-primary-btn w-full"
        >
          {isPending ? "Checking…" : "Enter admin passkey"}
        </Button>
      </AlertDialogContent>
    </AlertDialog>
  );
}
