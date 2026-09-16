import { Annotation } from "@langchain/langgraph";
import type { AlertPayload } from "../types/alert";
import type { SandboxExecutionResult } from "../types/sandbox";

export const IncidentStateAnnotation = Annotation.Root({
  incidentId: Annotation<string>(),
  alert: Annotation<AlertPayload>(),
  logs: Annotation<string[]>({
    reducer: (a, b) => a.concat(b),
    default: () => [],
  }),
  metrics: Annotation<Record<string, unknown>>(),
  hypothesis: Annotation<string | null>(),
  patchDiff: Annotation<string | null>(),
  sandboxResult: Annotation<SandboxExecutionResult | null>(),
  humanApproved: Annotation<boolean>(),
  retryCount: Annotation<number>({
    reducer: (a, b) => a + b,
    default: () => 0,
  }),
});

export type IncidentState = typeof IncidentStateAnnotation.State;
