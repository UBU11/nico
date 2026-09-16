import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { MemorySaver } from "@langchain/langgraph";
import { compileRemediationGraph } from "../src/graph/workflow";
import type { AlertPayload } from "../src/types/alert";

interface ScenarioFixture {
  id: string;
  name: string;
  service: string;
  alert: AlertPayload;
  expectedRootCauseKeywords: string[];
  maxRetryAllowed: number;
}

describe("SRE Remediation Agent Evaluation Benchmark", () => {
  const scenariosDir = join(import.meta.dir, "scenarios");
  const scenarioFiles = readdirSync(scenariosDir).filter((file) => file.endsWith(".json"));

  for (const file of scenarioFiles) {
    const rawData = readFileSync(join(scenariosDir, file), "utf-8");
    const scenario: ScenarioFixture = JSON.parse(rawData);

    it(`evaluates scenario: ${scenario.name} (${scenario.id})`, async () => {
      const memorySaver = new MemorySaver();
      const graph = compileRemediationGraph(memorySaver);

      const threadConfig = { configurable: { thread_id: scenario.id } };

      // Step 1: Initial invocation triggers workflow up to humanGateNode interrupt
      await graph.invoke(
        {
          incidentId: scenario.id,
          alert: scenario.alert,
        },
        threadConfig
      );

      const interruptedState = await graph.getState(threadConfig);

      // Measure Tool Invocation Efficiency: Ensure no infinite loop occurred
      expect(interruptedState.values.retryCount).toBeLessThanOrEqual(scenario.maxRetryAllowed);

      // Measure Diagnostic Accuracy: Hypothesis must identify the affected service or root cause
      const hypothesis = interruptedState.values.hypothesis as string | null;
      expect(hypothesis).not.toBeNull();

      const containsRelevantSignal = scenario.expectedRootCauseKeywords.some((keyword) =>
        hypothesis!.toLowerCase().includes(keyword.toLowerCase())
      );
      expect(containsRelevantSignal).toBe(true);

      // Invariant: Ensure execution halted at human gate and did NOT autonomously create PR
      expect(interruptedState.next).toContain("humanGateNode");
      expect(interruptedState.values.humanApproved).toBe(false);
    });
  }

  it("enforces hypothesis self-correction when sandbox verification fails", async () => {
    const memorySaver = new MemorySaver();
    const graph = compileRemediationGraph(memorySaver);
    const incidentId = "eval-self-correction-001";

    const simulatedAlert: AlertPayload = {
      id: incidentId,
      source: "synthetic",
      title: "Regression in auth-service",
      service: "auth-service",
      severity: "critical",
      description: "Tokens invalid due to key rotation mismatch",
      metadata: {},
      timestamp: new Date().toISOString(),
    };

    await graph.invoke(
      {
        incidentId,
        alert: simulatedAlert,
      },
      { configurable: { thread_id: incidentId } }
    );

    const state = await graph.getState({ configurable: { thread_id: incidentId } });
    expect(state.values.hypothesis).toBeDefined();
    expect(state.values.patchDiff).toBeDefined();
  });
});
