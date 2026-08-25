import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import RegisterForm from "@/components/forms/RegisterForm";
import { RegisterWizardProvider } from "@/components/forms/RegisterWizardProvider";
import { AuthShell } from "@/components/layout/AuthShell";
import { getPatient, getUser } from "@/lib/actions/patient.actions";

export const metadata: Metadata = { title: "Register" };

/**
 * Registration.
 *
 * This page used to live at `/patients/[userId]` while both forms redirected to
 * `/patients/[userId]/register` — so the flow 404'd. It also ignored `params`
 * entirely, discarding the very id it needed.
 *
 * `params` is a Promise in Next 16 and must be awaited.
 */
export default async function RegisterPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  const userResult = await getUser(userId);
  if (!userResult.ok) throw new Error(userResult.error.message);
  if (!userResult.data) notFound();

  // Already registered? Skip straight to booking rather than letting them
  // fill in 22 fields and hit a conflict on submit.
  //
  // Note: because the layout shell has already begun streaming by this point,
  // Next cannot emit a Location header and falls back to a meta-refresh
  // redirect. Browsers follow it; `curl` will show the placeholder body.
  const patientResult = await getPatient(userId);
  if (patientResult.ok && patientResult.data) {
    redirect(`/patients/${userId}/new-appointment`);
  }

  return (
    <RegisterWizardProvider user={userResult.data}>
      <AuthShell image={{ src: "/assets/images/register-img.png", alt: "" }}>
        <main id="main">
          <RegisterForm />
        </main>
      </AuthShell>
    </RegisterWizardProvider>
  );
}
