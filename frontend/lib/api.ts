/**
 * Thin fetch client for the Sheetlint API.
 *
 * Every response is Zod-validated before leaving this module — the rest of
 * the app works with typed objects, not raw JSON.
 */

import { env } from "@/lib/env";
import {
  type Job,
  type JobCreated,
  jobCreatedSchema,
  jobSchema,
} from "@/lib/schemas";

const API_BASE = env.NEXT_PUBLIC_API_URL.replace(/\/+$/, "");

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function readErrorDetail(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string };
    if (body?.detail) return body.detail;
  } catch {
    // fall through to statusText
  }
  return response.statusText || `HTTP ${response.status}`;
}

export async function submitAnalysis(file: File): Promise<JobCreated> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch(`${API_BASE}/api/v1/analysis`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    throw new ApiError(response.status, await readErrorDetail(response));
  }

  return jobCreatedSchema.parse(await response.json());
}

export async function getJob(jobId: string): Promise<Job> {
  const response = await fetch(`${API_BASE}/api/v1/jobs/${jobId}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new ApiError(response.status, await readErrorDetail(response));
  }

  return jobSchema.parse(await response.json());
}
