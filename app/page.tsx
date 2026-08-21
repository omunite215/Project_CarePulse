import Link from "next/link";

import PatientForm from "@/components/forms/PatientForm";
import { PasskeyModal } from "@/components/PasskeyModal";
import { AuthShell } from "@/components/layout/AuthShell";

/**
 * Onboarding.
 *
 * `searchParams` is a Promise in Next 16 and must be awaited. The original page
 * accepted no props at all, which is why its own `/?admin=true` footer link was
 * a dead end — nothing ever read the flag.
 */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ admin?: string }>;
}) {
  const { admin } = await searchParams;
  const isAdminRequest = admin === "true";

  return (
    <>
      {isAdminRequest ? <PasskeyModal /> : null}

      <AuthShell
        image={{ src: "/assets/images/onboarding-img.png", alt: "" }}
        imageClassName="max-w-[50%]"
        footerSlot={
          <Link
            href="/?admin=true"
            className="text-14-medium text-brand hover:underline"
          >
            Admin
          </Link>
        }
      >
        <main id="main">
          <PatientForm />
        </main>
      </AuthShell>
    </>
  );
}
