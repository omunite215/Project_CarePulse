import { z } from "zod";

export const PasskeySchema = z.object({
  passkey: z
    .string()
    .regex(/^\d{6}$/, { error: "Enter all six digits" }),
});

export type PasskeyValues = z.infer<typeof PasskeySchema>;
