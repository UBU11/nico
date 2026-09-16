import type Docker from "dockerode";
import { createPodmanClient } from "./socket";
import { truncateOutput } from "./truncator";
import type { SandboxRunOptions, SandboxExecutionResult } from "../../types/sandbox";

const HARD_MEMORY_LIMIT_BYTES = 536870912;
const HARD_NANO_CPUS = 1000000000;
const MAX_TIMEOUT_SECONDS = 30;

export async function runInSandbox(
  options: SandboxRunOptions,
  dockerClient: Docker = createPodmanClient()
): Promise<SandboxExecutionResult> {
  const timeoutMs = Math.min(options.timeoutSeconds, MAX_TIMEOUT_SECONDS) * 1000;
  const startTime = Date.now();

  let container: Docker.Container | null = null;
  let timedOut = false;

  try {
    container = await dockerClient.createContainer({
      Image: options.image,
      Cmd: options.command,
      WorkingDir: options.workingDir,
      Env: Object.entries(options.env).map(([key, val]) => `${key}=${val}`),
      HostConfig: {
        NetworkMode: "none",
        Memory: HARD_MEMORY_LIMIT_BYTES,
        NanoCpus: HARD_NANO_CPUS,
      },
    });

    const stream = await container.attach({
      stream: true,
      stdout: true,
      stderr: true,
    });

    let stdoutData = "";
    let stderrData = "";

    stream.on("data", (chunk: Buffer) => {
      stdoutData += chunk.toString("utf-8");
    });

    await container.start();

    const waitPromise = container.wait();
    const timerPromise = new Promise<{ StatusCode: number }>((_, reject) => {
      const timer = setTimeout(async () => {
        timedOut = true;
        try {
          if (container) {
            await container.kill({ signal: "SIGKILL" });
          }
        } catch {
          // Process might already be stopped
        }
        reject(new Error(`Sandbox execution exceeded timeout of ${timeoutMs}ms`));
      }, timeoutMs);

      waitPromise.finally(() => clearTimeout(timer));
    });

    let exitCode = -1;
    try {
      const waitResult = await Promise.race([waitPromise, timerPromise]);
      exitCode = waitResult.StatusCode ?? 0;
    } catch (raceError) {
      if (!timedOut) {
        throw raceError;
      }
      stderrData += `\nExecution timed out after ${timeoutMs}ms (forced SIGKILL).`;
    }

    const durationMs = Date.now() - startTime;
    return {
      exitCode,
      stdout: truncateOutput(stdoutData),
      stderr: truncateOutput(stderrData),
      durationMs,
      timedOut,
      success: exitCode === 0 && !timedOut,
    };
  } finally {
    if (container) {
      try {
        await container.remove({ force: true });
      } catch {
        // Suppress cleanup error to preserve primary error
      }
    }
  }
}
