import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Providers } from "./providers";

const fontSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  // Deliberately NOT `--font-sans`: that is the Tailwind v4 theme token name,
  // and `--font-sans: var(--font-sans)` would be a circular reference.
  variable: "--font-plus-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "CarePulse — Patient & Appointment Management",
    template: "%s · CarePulse",
  },
  description:
    "Patient intake and appointment management for small clinics. Book, review, and schedule in one place.",
  applicationName: "CarePulse",
  icons: { icon: "/favicon.ico" },
  openGraph: {
    title: "CarePulse",
    description:
      "Patient intake and appointment management for small clinics.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#131619" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-background font-sans text-foreground antialiased",
          fontSans.variable,
        )}
      >
        {/* Keyboard users should not have to tab through the header on every
            page to reach the form. */}
        <a
          href="#main"
          className="text-14-medium sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-green-500 focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
