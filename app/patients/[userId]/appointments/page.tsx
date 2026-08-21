import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlusIcon } from "lucide-react";

import { AppointmentCard } from "@/components/patient/AppointmentCard";
import { AuthShell } from "@/components/layout/AuthShell";
import { EmptyState } from "@/components/states/EmptyState";
import { Button } from "@/components/ui/button";
import { listMyAppointments } from "@/lib/actions/appointment.actions";
import { getUser } from "@/lib/actions/patient.actions";

export const metadata: Metadata = { title: "My appointments" };

export default async function MyAppointmentsPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  const userResult = await getUser(userId);
  if (!userResult.ok) throw new Error(userResult.error.message);
  if (!userResult.data) notFound();

  const result = await listMyAppointments(userId);
  if (!result.ok) throw new Error(result.error.message);

  const appointments = result.data;
  const now = new Date();
  const upcoming = appointments.filter(
    (a) => new Date(a.schedule) >= now && a.status !== "cancelled",
  );
  const past = appointments.filter(
    (a) => new Date(a.schedule) < now || a.status === "cancelled",
  );

  return (
    <AuthShell
      image={{ src: "/assets/images/appointment-img.png", alt: "" }}
      footerSlot={
        <Link
          href={`/patients/${userId}/new-appointment`}
          className="text-14-medium text-brand hover:underline"
        >
          Book another
        </Link>
      }
    >
      <main id="main" className="space-y-10">
        <section className="space-y-2">
          <h1 className="header">Your appointments</h1>
          <p className="text-foreground/80">
            {userResult.data.name}, here is everything on your record.
          </p>
        </section>

        {appointments.length === 0 ? (
          <EmptyState
            Icon={CalendarPlusIcon}
            title="No appointments yet"
            description="Once you book, your appointments will show up here."
            action={
              <Button asChild className="shad-primary-btn">
                <Link href={`/patients/${userId}/new-appointment`}>
                  Book an appointment
                </Link>
              </Button>
            }
          />
        ) : (
          <>
            <section className="space-y-4">
              <h2 className="sub-header text-foreground">
                Upcoming ({upcoming.length})
              </h2>
              {upcoming.length === 0 ? (
                <p className="text-14-regular text-muted-foreground">
                  Nothing upcoming.
                </p>
              ) : (
                upcoming.map((appointment) => (
                  <AppointmentCard
                    key={appointment.id}
                    appointment={appointment}
                    userId={userId}
                  />
                ))
              )}
            </section>

            {past.length > 0 ? (
              <section className="space-y-4">
                <h2 className="sub-header text-foreground">
                  Past and cancelled ({past.length})
                </h2>
                {past.map((appointment) => (
                  <AppointmentCard
                    key={appointment.id}
                    appointment={appointment}
                    userId={userId}
                  />
                ))}
              </section>
            ) : null}
          </>
        )}
      </main>
    </AuthShell>
  );
}
