import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { findDoctor } from "@/constants";
import { getAppointment } from "@/lib/actions/appointment.actions";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Appointment requested" };

export default async function SuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ appointmentId?: string }>;
}) {
  const { userId } = await params;

  return (
    <div className="page-shell flex min-h-dvh">
      <div className="success-img">
        <Link href="/" aria-label="CarePulse home">
          <Image
            src="/assets/icons/logo-full.svg"
            height={1000}
            width={1000}
            alt="CarePulse"
            className="h-10 w-fit"
          />
        </Link>

        <section className="flex flex-col items-center">
          <Image
            src="/assets/gifs/success.gif"
            height={300}
            width={280}
            alt=""
            aria-hidden="true"
            unoptimized
          />
          <h1 className="header mb-6 max-w-2xl text-center">
            Your <span className="text-green-500">appointment request</span> has
            been submitted
          </h1>
          <p className="text-foreground/80">We&apos;ll be in touch shortly to confirm.</p>
        </section>

        {/* The confirmation message and animation do not depend on the lookup,
            so they paint immediately while the details stream in. */}
        <Suspense fallback={<DetailsSkeleton />}>
          <AppointmentDetails searchParams={searchParams} />
        </Suspense>

        <Button asChild className="shad-primary-btn">
          <Link href={`/patients/${userId}/new-appointment`}>
            New appointment
          </Link>
        </Button>

        <div className="flex items-center gap-6">
          <Link
            href={`/patients/${userId}/appointments`}
            className="text-14-medium text-brand hover:underline"
          >
            View my appointments
          </Link>
          <p className="copyright">© {new Date().getFullYear()} CarePulse</p>
        </div>
      </div>
    </div>
  );
}

async function AppointmentDetails({
  searchParams,
}: {
  searchParams: Promise<{ appointmentId?: string }>;
}) {
  const { appointmentId } = await searchParams;
  if (!appointmentId) notFound();

  const result = await getAppointment(appointmentId);
  if (!result.ok) throw new Error(result.error.message);
  if (!result.data) notFound();

  const appointment = result.data;
  const doctor = findDoctor(appointment.primaryPhysician);

  return (
    <section className="request-details">
      <p className="text-14-regular text-foreground/80">Requested appointment</p>

      <div className="flex items-center gap-3">
        {doctor ? (
          <Image
            src={doctor.image}
            alt=""
            aria-hidden="true"
            width={100}
            height={100}
            className="size-8 rounded-full border border-border"
          />
        ) : null}
        <p className="whitespace-nowrap">
          Dr. {appointment.primaryPhysician}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Image
          src="/assets/icons/calendar.svg"
          height={24}
          width={24}
          alt=""
          aria-hidden="true"
        />
        <p>{formatDateTime(appointment.schedule).dateTime}</p>
      </div>

      <StatusBadge status={appointment.status} />
    </section>
  );
}

function DetailsSkeleton() {
  return (
    <div
      aria-busy="true"
      className="flex w-full flex-col items-center gap-6 border-y-2 border-border py-8 md:w-fit md:flex-row md:gap-8"
    >
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-8 w-44" />
      <Skeleton className="h-4 w-52" />
      <Skeleton className="h-9 w-28 rounded-full" />
    </div>
  );
}
