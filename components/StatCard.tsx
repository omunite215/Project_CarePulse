"use client";

import Image from "next/image";
import { animate, useMotionValue, useTransform } from "motion/react";
import { m, useReducedMotion } from "motion/react";
import { useEffect } from "react";

import { StatCardBackground, StatusIcon } from "@/constants";
import type { AppointmentStatus } from "@/lib/data/types";
import { cn } from "@/lib/utils";

interface StatCardProps {
  type: AppointmentStatus;
  count: number;
  label: string;
}

/**
 * Dashboard counter with an animated count-up.
 *
 * The number is rendered as text immediately at its final value when the user
 * prefers reduced motion — a counter that ticks is decorative, and the figure
 * itself is the information.
 */
export function StatCard({ type, count, label }: StatCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const value = useMotionValue(shouldReduceMotion ? count : 0);
  const rounded = useTransform(value, (latest) => Math.round(latest));

  useEffect(() => {
    if (shouldReduceMotion) {
      value.set(count);
      return;
    }
    const controls = animate(value, count, {
      duration: 0.7,
      ease: "easeOut",
    });
    return () => controls.stop();
  }, [count, shouldReduceMotion, value]);

  return (
    <article className={cn("stat-card", StatCardBackground[type])}>
      <div className="flex items-center gap-4">
        <Image
          src={StatusIcon[type]}
          height={32}
          width={32}
          alt=""
          aria-hidden="true"
          className="size-8 w-fit"
        />
        <h2 className="text-32-bold text-white">
          {/* The accessible name carries the real number; the animated node is
              hidden so screen readers do not announce every intermediate tick. */}
          <span className="sr-only">{count}</span>
          <m.span aria-hidden="true">{rounded}</m.span>
        </h2>
      </div>
      <p className="text-14-regular">{label}</p>
    </article>
  );
}
