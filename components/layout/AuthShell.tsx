import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { ThemeToggle } from "@/components/ThemeToggle";
import { DemoBanner } from "@/components/DemoBanner";

interface AuthShellProps {
  children: ReactNode;
  /** Decorative hero image. Fills the grid's second track. */
  image: { src: string; alt: string };
  /** Rendered under the content, e.g. the admin link. */
  footerSlot?: ReactNode;
  /**
   * Content laid over the hero image track, e.g. the registration step
   * indicator. Absent on every other page, which keeps their rendering
   * byte-identical.
   *
   * The overlay supplies its own background. The hero is `object-cover`, so
   * the visible crop moves with viewport height — text relying on the photo
   * being dark in a given region is betting on a crop it does not control.
   */
  asideOverlay?: ReactNode;
}

/**
 * The two-column shell shared by onboarding, registration and booking.
 *
 * Extracted because the original duplicated this markup — logo, container,
 * copyright, admin link, side image — across every page, so the pages drifted
 * apart and each `loading.tsx` would have had to re-guess the layout. Sharing
 * it is what lets the skeletons match the real chrome exactly, which is the
 * difference between a skeleton and a layout shift.
 *
 * The image is a grid *track*, not a floating element with a max-width. The
 * previous version capped it per-page with two different one-off width
 * values passed in from each caller, so above roughly 1100px the content
 * stopped growing, the image stopped growing, and everything between them
 * became dead gutter.
 *
 * `min-h-dvh` rather than `h-screen`: `h-screen` resolves against the layout
 * viewport, so on mobile the bottom of the form sits behind the browser chrome.
 * Page-level scrolling also means the scrollbar stays visible — the old shell
 * scrolled an inner element with `remove-scrollbar`, which hid the only
 * scroll-position cue a 22-field form gives you.
 */
export function AuthShell({ children, image, footerSlot, asideOverlay }: AuthShellProps) {
  return (
    <div className="grid min-h-dvh grid-cols-1 md:grid-cols-shell-md lg:grid-cols-shell-lg xl:grid-cols-shell-xl 2xl:grid-cols-shell-2xl">
      <section className="page-shell flex max-w-5xl flex-col py-8 sm:py-10 lg:py-14 2xl:max-w-8xl">
        <DemoBanner />

        <header className="mb-10 flex items-center justify-between lg:mb-12">
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

        {/* mt-auto pins the footer to the bottom of a short page without the
            fixed `mt-16` pushing it off a tall one. */}
        <footer className="mt-auto flex items-center justify-between pt-16">
          <p className="copyright">© {new Date().getFullYear()} CarePulse</p>
          {footerSlot}
        </footer>
      </section>

      {/* `relative` is load-bearing: next/image `fill` positions against the
          nearest positioned ancestor and silently collapses without it. */}
      <aside className="relative hidden md:block">
        <Image
          src={image.src}
          alt={image.alt}
          fill
          sizes="(min-width: 1536px) 34rem, (min-width: 1280px) 28rem, (min-width: 1024px) 22rem, 16rem"
          className="object-cover"
          priority
        />
        {asideOverlay ? (
          <div className="absolute inset-0 flex items-center p-6">
            {asideOverlay}
          </div>
        ) : null}
      </aside>
    </div>
  );
}
