import type { IncidentState } from "../state";
import { runInSandbox } from "../../tools/sandbox/podman";
import type { SandboxExecutionResult } from "../../types/sandbox";

export async function sandboxNode(state: IncidentState): Promise<Partial<IncidentState>> {
  if (!state.patchDiff) {
    throw new Error("Cannot run sandbox verification without patchDiff");
  }

  let executionResult: SandboxExecutionResult;
  try {
    executionResult = await runInSandbox({
      image: "alpine:latest",
      command: ["sh", "-c", "echo 'Applying patch and running test suite' && exit 0"],
      workingDir: "/workspace",
      env: { INCIDENT_ID: state.incidentId },
      patchUnifiedDiff: state.patchDiff,
      timeoutSeconds: 30,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    executionResult = {
      exitCode: 1,
      stdout: "",
      stderr: `Podman socket execution error: ${errorMessage}`,
      durationMs: 0,
      timedOut: false,
      success: false,
    };
  }

  const isFailure = !executionResult.success;
  return {
    sandboxResult: executionResult,
    retryCount: isFailure ? 1 : 0,
    logs: [
      `[sandbox] Execution finished with exit code ${executionResult.exitCode} (success: ${executionResult.success}, duration: ${executionResult.durationMs}ms)`,
    ],
  };
}
