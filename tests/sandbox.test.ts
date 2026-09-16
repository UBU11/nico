import { describe, expect, it } from "bun:test";
import { truncateOutput, MAX_OUTPUT_CHARS } from "../src/tools/sandbox/truncator";
import { getPodmanSocketPath } from "../src/tools/sandbox/socket";
import { SandboxRunOptionsSchema } from "../src/types/sandbox";

describe("Sandbox Isolation & Truncator Unit Tests", () => {
  it("keeps output intact if under character limit", () => {
    const input = "Short container log message";
    expect(truncateOutput(input)).toBe(input);
  });

  it("truncates output exceeding 4,000 characters and appends notice", () => {
    const largeInput = "A".repeat(5000);
    const truncated = truncateOutput(largeInput, 4000);

    expect(truncated.length).toBeLessThanOrEqual(4000);
    expect(truncated).toContain("... [output truncated: exceeded 4000 characters]");
  });

  it("resolves rootless Podman user socket path dynamically", () => {
    const socketPath = getPodmanSocketPath();
    expect(socketPath).toContain("/podman/podman.sock");
  });

  it("enforces max 30s timeout on sandbox run options schema", () => {
    const valid = SandboxRunOptionsSchema.safeParse({
      command: ["echo", "test"],
      timeoutSeconds: 30,
    });
    expect(valid.success).toBe(true);

    const invalid = SandboxRunOptionsSchema.safeParse({
      command: ["echo", "test"],
      timeoutSeconds: 60,
    });
    expect(invalid.success).toBe(false);
  });
});
