"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { LazyMotion, MotionConfig, domAnimation } from "motion/react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";
import { Toaster } from "sonner";

import { ThemeProvider } from "@/components/theme-provider";
import { OfflineBanner } from "@/components/OfflineBanner";
import { getQueryClient } from "@/lib/query/client";

export function Providers({ children }: { children: ReactNode }) {
  // Not useState: getQueryClient already returns a browser singleton, and
  // creating one in render would discard the cache on every suspense retry.
  const queryClient = getQueryClient();

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <NuqsAdapter>
          {/*
            `LazyMotion` + `domAnimation` loads only the DOM animation feature
            set (~18 KB rather than motion's full ~34 KB). Components must use
            the `m` component rather than `motion` for this to pay off.

            `reducedMotion="user"` makes every animation respect the OS setting
            without each component checking.
          */}
          <LazyMotion features={domAnimation} strict>
            <MotionConfig reducedMotion="user">
              <OfflineBanner />
              {children}
              <Toaster
                position="top-center"
                richColors
                closeButton
                toastOptions={{
                  classNames: {
                    toast: "border-border bg-surface text-foreground",
                  },
                }}
              />
            </MotionConfig>
          </LazyMotion>
        </NuqsAdapter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
