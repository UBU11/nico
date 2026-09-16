import { z } from "zod";

export const AlertmanagerAlertItemSchema = z.object({
  status: z.enum(["firing", "resolved"]),
  labels: z.record(z.string(), z.string()),
  annotations: z.record(z.string(), z.string()),
  startsAt: z.string(),
  endsAt: z.string().optional(),
  generatorURL: z.string().optional(),
  fingerprint: z.string().optional(),
});

export const AlertmanagerPayloadSchema = z.object({
  receiver: z.string(),
  status: z.enum(["firing", "resolved"]),
  alerts: z.array(AlertmanagerAlertItemSchema).min(1),
  groupLabels: z.record(z.string(), z.string()).optional(),
  commonLabels: z.record(z.string(), z.string()).optional(),
  commonAnnotations: z.record(z.string(), z.string()).optional(),
  externalURL: z.string().optional(),
});

export const GitHubActionsFailurePayloadSchema = z.object({
  workflow: z.string(),
  runId: z.coerce.string(),
  repository: z.string(),
  sha: z.string(),
  branch: z.string(),
  actor: z.string(),
  failedStep: z.string(),
  logsUrl: z.string().url().optional(),
});

export const CanonicalAlertSchema = z.object({
  id: z.string(),
  source: z.enum(["alertmanager", "github_actions", "synthetic"]),
  title: z.string(),
  service: z.string(),
  severity: z.enum(["critical", "warning", "info"]),
  description: z.string(),
  metadata: z.record(z.string(), z.unknown()),
  timestamp: z.string(),
});

export type AlertmanagerAlertItem = z.infer<typeof AlertmanagerAlertItemSchema>;
export type AlertmanagerPayload = z.infer<typeof AlertmanagerPayloadSchema>;
export type GitHubActionsFailurePayload = z.infer<typeof GitHubActionsFailurePayloadSchema>;
export type AlertPayload = z.infer<typeof CanonicalAlertSchema>;
