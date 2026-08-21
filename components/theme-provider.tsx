"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * next-themes 0.4 removed the `next-themes/dist/types` entry point that used to
 * export `ThemeProviderProps`. Deriving the props from the component itself is
 * both correct and version-proof.
 */
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
