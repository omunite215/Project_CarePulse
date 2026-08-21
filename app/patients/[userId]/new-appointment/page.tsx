import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import AppointmentForm from "@/components/forms/AppointmentForm";
import { AuthShell } from "@/components/layout/AuthShell";
import { getPatient } from "@/lib/actions/patient.actions";

export const metadata: Metadata = { title: "New appointment" };

export default async function NewAppointmentPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  const patientResult = await getPatient(userId);
  if (!patientResult.ok) throw new Error(patientResult.error.message);

  // You cannot book without a patient record; send them to complete it rather
  // than showing a form that will fail on submit.
  if (!patientResult.data) redirect(`/patients/${userId}/register`);

  return (
    <AuthShell
      image={{ src: "/assets/images/appointment-img.png", alt: "" }}
      footerSlot={
        <Link
          href={`/patients/${userId}/appointments`}
          className="text-14-medium text-brand hover:underline"
        >
          My appointments
        </Link>
      }
    >
      <main id="main">
        <AppointmentForm
          type="create"
          userId={userId}
          patientId={patientResult.data.id}
        />
      </main>
    </AuthShell>
  );
}
