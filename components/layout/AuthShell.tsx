import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { ThemeToggle } from "@/components/ThemeToggle";
import { DemoBanner } from "@/components/DemoBanner";
import { cn } from "@/lib/utils";

interface AuthShellProps {
  children: ReactNode;
  /** Right-hand hero image. */
  image: { src: string; alt: string };
  imageClassName?: string;
  /** Rendered under the content, e.g. the admin link. */
  footerSlot?: ReactNode;
  containerClassName?: string;
}

/**
 * The two-column shell shared by onboarding, registration and booking.
 *
 * Extracted because the original duplicated this markup — logo, container,
 * copyright, admin link, side image — across every page, so the pages drifted
 * apart and each `loading.tsx` would have had to re-guess the layout. Sharing
 * it is what lets the skeletons match the real chrome exactly, which is the
 * difference between a skeleton and a layout shift.
 */
export function AuthShell({
  children,
  image,
  imageClassName,
  footerSlot,
  containerClassName,
}: AuthShellProps) {
  return (
    <div className="flex h-screen max-h-screen">
      <section
        className={cn(
          "remove-scrollbar page-container my-auto",
          containerClassName,
        )}
      >
        <div className="sub-container max-w-[860px]">
          <DemoBanner />

          <header className="mb-12 flex items-center justify-between">
            <Link href="/" aria-label="CarePulse home">
              <Image
                src="/assets/icons/logo-full.svg"
                height={1000}
                width={1000}
                alt="CarePulse"
                className="h-10 w-fit"
                priority
              />
            </Link>
            <ThemeToggle />
          </header>

          {children}

          <footer className="mt-16 flex items-center justify-between">
            <p className="copyright">
              © {new Date().getFullYear()} CarePulse
            </p>
            {footerSlot}
          </footer>
        </div>
      </section>

      <Image
        src={image.src}
        height={1000}
        width={1000}
        alt={image.alt}
        className={cn("side-img", imageClassName)}
        priority
      />
    </div>
  );
}
