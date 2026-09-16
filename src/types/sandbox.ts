import { z } from "zod";

export const SandboxRunOptionsSchema = z.object({
  image: z.string().default("alpine:latest"),
  command: z.array(z.string()).min(1),
  workingDir: z.string().default("/workspace"),
  env: z.record(z.string(), z.string()).default({}),
  patchUnifiedDiff: z.string().optional(),
  timeoutSeconds: z.number().int().positive().max(30).default(30),
});

export const SandboxExecutionResultSchema = z.object({
  exitCode: z.number().int(),
  stdout: z.string(),
  stderr: z.string(),
  durationMs: z.number().nonnegative(),
  timedOut: z.boolean(),
  success: z.boolean(),
});

export type SandboxRunOptions = z.infer<typeof SandboxRunOptionsSchema>;
export type SandboxExecutionResult = z.infer<typeof SandboxExecutionResultSchema>;
