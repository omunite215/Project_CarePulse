import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { DemoBanner } from "@/components/DemoBanner";
import { SignOutButton } from "@/components/admin/SignOutButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { requireAdmin } from "@/lib/auth/guards";
import { getRepository } from "@/lib/data";
import { appointmentKeys } from "@/lib/query/keys";
import { makeQueryClient } from "@/lib/query/client";

export const metadata: Metadata = { title: "Admin dashboard" };

/**
 * Admin shell.
 *
 * Server-renders the chrome, then seeds the React Query cache with the first
 * page so the client table hydrates with data already in hand — no fetch on
 * first paint.
 *
 * The seed uses `setQueryData` rather than `prefetchQuery` deliberately: the
 * data comes from the repository directly, so there is no point routing it back
 * out through `/api/v1` and paying an HTTP round trip during SSR.
 */
export default async function AdminPage() {
  // `proxy.ts` already redirects unauthenticated visitors. This is the
  // authorisation check — middleware protects navigation, not data.
  await requireAdmin();

  const repo = await getRepository();
  const initial = await repo.listAppointments({ page: 1, pageSize: 10 });

  const queryClient = makeQueryClient();
  queryClient.setQueryData(
    appointmentKeys.list({
      status: "all",
      page: 1,
      pageSize: 10,
      sort: "createdAt",
      direction: "desc",
    }),
    initial,
  );

  return (
    <div className="mx-auto flex max-w-7xl flex-col space-y-14 2xl:max-w-8xl">
      <header className="admin-header">
        <Link href="/" aria-label="CarePulse home" className="cursor-pointer">
          <Image
            src="/assets/icons/logo-full.svg"
            height={32}
            width={162}
            alt="CarePulse"
            className="h-8 w-fit"
          />
        </Link>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          <p className="text-16-semibold hidden sm:block">Admin dashboard</p>
          <SignOutButton />
        </div>
      </header>

      <main id="main" className="admin-main">
        <section className="w-full space-y-4">
          <DemoBanner />
          <h1 className="header">Welcome back 👋</h1>
          <p className="text-foreground/80">
            Review and manage new appointment requests.
          </p>
        </section>

        <HydrationBoundary state={dehydrate(queryClient)}>
          <AdminDashboard />
        </HydrationBoundary>
      </main>
    </div>
  );
}
