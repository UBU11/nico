import { z } from "zod";

export const LokiQueryOptionsSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().positive().max(500).default(50),
  start: z.string().optional(),
  end: z.string().optional(),
});

export const LokiLogEntrySchema = z.object({
  timestamp: z.string(),
  line: z.string(),
  labels: z.record(z.string(), z.string()).default({}),
});

export const LokiQueryResultSchema = z.object({
  entries: z.array(LokiLogEntrySchema),
  query: z.string(),
  totalFetched: z.number().int().nonnegative(),
});

export const PrometheusQueryOptionsSchema = z.object({
  query: z.string().min(1),
  time: z.string().optional(),
});

export const PrometheusMetricSampleSchema = z.object({
  metric: z.record(z.string(), z.string()),
  value: z.tuple([z.number(), z.string()]),
});

export const PrometheusQueryResultSchema = z.object({
  resultType: z.string(),
  result: z.array(PrometheusMetricSampleSchema),
});

export const GitInspectOptionsSchema = z.object({
  baseRef: z.string().default("HEAD~1"),
  targetRef: z.string().default("HEAD"),
  path: z.string().optional(),
});

export const GitInspectResultSchema = z.object({
  diff: z.string(),
  modifiedFiles: z.array(z.string()),
});

export type LokiQueryOptions = z.infer<typeof LokiQueryOptionsSchema>;
export type LokiLogEntry = z.infer<typeof LokiLogEntrySchema>;
export type LokiQueryResult = z.infer<typeof LokiQueryResultSchema>;
export type PrometheusQueryOptions = z.infer<typeof PrometheusQueryOptionsSchema>;
export type PrometheusMetricSample = z.infer<typeof PrometheusMetricSampleSchema>;
export type PrometheusQueryResult = z.infer<typeof PrometheusQueryResultSchema>;
export type GitInspectOptions = z.infer<typeof GitInspectOptionsSchema>;
export type GitInspectResult = z.infer<typeof GitInspectResultSchema>;
