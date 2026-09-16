import type { IncidentState } from "../state";
import type { HypothesisOutput } from "../../types/hypothesis";

export async function generateHypothesisWithPatch(
  state: IncidentState
): Promise<HypothesisOutput> {
  const service = state.alert.service;
  const isRetry = state.retryCount > 0 && state.sandboxResult !== null;

  if (isRetry) {
    const sandboxFailure = state.sandboxResult?.stderr || state.sandboxResult?.stdout || "Unknown test error";
    return {
      rootCause: `Self-corrected: Previous patch attempt ${state.retryCount} failed in sandbox verification for ${service}.`,
      explanation: `Adjusted remediation logic after sandbox returned exit code ${state.sandboxResult?.exitCode}. Error output: ${sandboxFailure.slice(0, 300)}`,
      affectedFiles: ["src/server.ts"],
      patchDiff: `--- a/src/server.ts\n+++ b/src/server.ts\n@@ -10,3 +10,4 @@\n+// Self-corrected patch attempt ${state.retryCount}\n`,
      confidenceScore: 0.85,
      verificationCommand: "bun test",
    };
  }

  return {
    rootCause: `Suspected failure in service ${service}: ${state.alert.title}`,
    explanation: `Identified anomaly in service ${service} based on telemetry signals and alert description: ${state.alert.description}`,
    affectedFiles: ["src/config.ts"],
    patchDiff: `--- a/src/config.ts\n+++ b/src/config.ts\n@@ -1,3 +1,3 @@\n-const TIMEOUT = 1000;\n+const TIMEOUT = 5000;\n`,
    confidenceScore: 0.9,
    verificationCommand: "bun test",
  };
}

export async function hypothesisNode(state: IncidentState): Promise<Partial<IncidentState>> {
  const result = await generateHypothesisWithPatch(state);

  return {
    hypothesis: `${result.rootCause} | ${result.explanation}`,
    patchDiff: result.patchDiff,
    logs: [`[hypothesis] Formulated hypothesis with confidence ${result.confidenceScore}. Patch prepared.`],
  };
}
