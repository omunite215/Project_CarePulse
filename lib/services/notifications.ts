import "server-only";

import { ID } from "node-appwrite";

import { getServerEnv } from "@/lib/env";
import { formatDateTime } from "@/lib/utils";

/**
 * SMS notifications.
 *
 * Appwrite Messaging fans out to Twilio, which is configured in the Appwrite
 * console rather than in this codebase — there is no `twilio` dependency by
 * design.
 *
 * Sending is deliberately best-effort: a failed SMS must never roll back a
 * successfully rescheduled appointment. Failures are logged and surfaced in the
 * return value so the caller can tell the user "rescheduled, but we couldn't
 * text them".
 */

export interface NotificationResult {
  sent: boolean;
  /** Populated in demo mode so the UI can show what *would* have been sent. */
  preview?: string;
  error?: string;
}

const DEMO_OUTBOX_KEY = Symbol.for("carepulse.demo.outbox");

type GlobalWithOutbox = typeof globalThis & {
  [DEMO_OUTBOX_KEY]?: { to: string; content: string; at: string }[];
};

/** Demo-mode sent-message log, readable by the UI and by tests. */
export function getDemoOutbox() {
  const g = globalThis as GlobalWithOutbox;
  g[DEMO_OUTBOX_KEY] ??= [];
  return g[DEMO_OUTBOX_KEY]!;
}

export async function sendSmsNotification(
  userId: string,
  content: string,
): Promise<NotificationResult> {
  const env = getServerEnv();

  if (env.dataSource === "demo") {
    getDemoOutbox().push({
      to: userId,
      content,
      at: new Date().toISOString(),
    });
    return { sent: true, preview: content };
  }

  try {
    const { getAppwrite } = await import("@/lib/data/appwrite/client");
    const { messaging } = getAppwrite();
    await messaging.createSms({
      messageId: ID.unique(),
      content,
      users: [userId],
    });
    return { sent: true, preview: content };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown messaging error";
    console.error("[notifications] SMS delivery failed:", message);
    return { sent: false, error: message, preview: content };
  }
}

/** Copy for a newly confirmed appointment. */
export function scheduledMessage(schedule: string, physician: string) {
  return `Hi, it's CarePulse. Your appointment has been scheduled for ${
    formatDateTime(schedule).dateTime
  } with Dr. ${physician}.`;
}

/** Copy for a cancellation. */
export function cancelledMessage(schedule: string, reason: string) {
  return `Hi, it's CarePulse. We regret to inform you that your appointment for ${
    formatDateTime(schedule).dateTime
  } has been cancelled. Reason: ${reason}`;
}
