"use client";

import { LogOutIcon } from "lucide-react";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { signOutAdmin } from "@/lib/actions/admin.actions";

export function SignOutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={() => startTransition(() => signOutAdmin())}
      className="gap-2 text-foreground/80"
    >
      <LogOutIcon className="size-4" aria-hidden="true" />
      {isPending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
