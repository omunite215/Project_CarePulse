"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
  { value: "system", label: "System", Icon: MonitorIcon },
] as const;

/**
 * Theme switcher.
 *
 * next-themes was already installed but purely decorative: `<body>` hardcoded
 * `bg-dark-300`, there were no light-theme tokens, and nothing rendered a
 * control. With the token layer in place this now actually works.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // The server cannot know the resolved theme, so rendering the active state
  // before mount guarantees a hydration mismatch.
  useEffect(() => setMounted(true), []);

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="flex items-center gap-0.5 rounded-full border border-border bg-surface p-0.5"
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const isActive = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              "rounded-full p-1.5 transition-colors",
              isActive
                ? "bg-green-500 text-white"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
