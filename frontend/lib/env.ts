/**
 * Public environment — inlined at build time via NEXT_PUBLIC_*.
 *
 * Server-only secrets never belong here. Validate at import time so a
 * missing/misshapen value fails the build, not at first request.
 */

import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z.url().default("http://localhost:8000"),
});

export const env = envSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
});
