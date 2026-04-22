/**
 * Zod schemas mirroring the FastAPI backend Pydantic models.
 *
 * These are the contract at the network boundary — everything from
 * `fetch(...).json()` flows through `.parse()` before touching the UI.
 * Keep in sync with src/sheetlint/{analysis,jobs}/schemas.py.
 */

import { z } from "zod";

export const severitySchema = z.enum(["critical", "warning", "info"]);
export type Severity = z.infer<typeof severitySchema>;

export const findingSchema = z.object({
  detector: z.string(),
  severity: severitySchema,
  sheet: z.string(),
  message: z.string(),
  column: z.string().nullable(),
  rows: z.array(z.number()),
  suggested_fix: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  row_count: z.number(),
});
export type Finding = z.infer<typeof findingSchema>;

export const anomalyResultSchema = z.object({
  detector: z.string(),
  series_name: z.string(),
  scores: z.array(z.number()),
  flagged_indices: z.array(z.number()),
  explanation: z.string(),
  metadata: z.record(z.string(), z.unknown()),
});
export type AnomalyResult = z.infer<typeof anomalyResultSchema>;

export const trustScoreSchema = z.object({
  score: z.number(),
  grade: z.string(),
  breakdown: z.record(z.string(), z.number()),
  by_severity: z.record(z.string(), z.number()),
});
export type TrustScore = z.infer<typeof trustScoreSchema>;

export const analysisResultSchema = z.object({
  filename: z.string(),
  trust_score: trustScoreSchema,
  findings: z.array(findingSchema),
  anomalies: z.array(anomalyResultSchema),
  inferred_schemas: z.record(z.string(), z.string()),
});
export type AnalysisResult = z.infer<typeof analysisResultSchema>;

export const jobStatusSchema = z.enum([
  "pending",
  "running",
  "succeeded",
  "failed",
]);
export type JobStatus = z.infer<typeof jobStatusSchema>;

export const jobSchema = z.object({
  id: z.uuid(),
  status: jobStatusSchema,
  filename: z.string(),
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
  result: analysisResultSchema.nullable(),
  error: z.string().nullable(),
});
export type Job = z.infer<typeof jobSchema>;

export const jobCreatedSchema = z.object({
  id: z.uuid(),
  status: jobStatusSchema,
  status_url: z.string(),
});
export type JobCreated = z.infer<typeof jobCreatedSchema>;

/**
 * Narrowed shape of the metadata the TimeSeriesDetector ships through
 * `AnomalyResult.metadata`. Parse on read — the backing field is
 * intentionally untyped at the API layer for forward compatibility.
 */
export const timeSeriesMetadataSchema = z.object({
  date_column: z.string(),
  num_column: z.string(),
  window: z.number(),
  dates: z.array(z.string()),
  values: z.array(z.number()),
  z_flagged: z.array(z.number()),
  mp_flagged: z.array(z.number()),
});
export type TimeSeriesMetadata = z.infer<typeof timeSeriesMetadataSchema>;
