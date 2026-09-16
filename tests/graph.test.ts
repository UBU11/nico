import { describe, expect, it } from "bun:test";
import { MemorySaver, Command } from "@langchain/langgraph";
import { triageNode } from "../src/graph/nodes/triage";
import { prNode } from "../src/graph/nodes/pr";
import { routeAfterSandbox, routeAfterGate, compileRemediationGraph } from "../src/graph/workflow";
import type { IncidentState } from "../src/graph/state";
import type { AlertPayload } from "../src/types/alert";

describe("LangGraph State Machine & Node Transforms", () => {
  const sampleAlert: AlertPayload = {
    id: "test-alert-001",
    source: "alertmanager",
    title: "Database connection failed for user test@example.com",
    service: "auth-service",
    severity: "critical",
    description: "Bearer secret_token_12345 auth failed with password=supersecretpassword",
    metadata: {},
    timestamp: "2026-09-16T12:00:00Z",
  };

  it("triageNode scrubs PII and secret tokens", async () => {
    const initialState: IncidentState = {
      incidentId: "test-alert-001",
      alert: sampleAlert,
      logs: [],
      metrics: {},
      hypothesis: null,
      patchDiff: null,
      sandboxResult: null,
      humanApproved: false,
      retryCount: 0,
    };

    const result = await triageNode(initialState);
    expect(result.alert?.description).toContain("Bearer [REDACTED]");
    expect(result.alert?.description).toContain("password=[REDACTED]");
    expect(result.alert?.title).toContain("[REDACTED_EMAIL]");
    expect(result.alert?.description).not.toContain("secret_token_12345");
  });

  it("routes after sandbox correctly based on success and retry count", () => {
    const failedState: IncidentState = {
      incidentId: "inc-1",
      alert: sampleAlert,
      logs: [],
      metrics: {},
      hypothesis: "Test hypothesis",
      patchDiff: "--- patch",
      sandboxResult: {
        exitCode: 1,
        stdout: "",
        stderr: "Tests failed",
        durationMs: 100,
        timedOut: false,
        success: false,
      },
      humanApproved: false,
      retryCount: 1,
    };

    expect(routeAfterSandbox(failedState)).toBe("hypothesisNode");

    const maxRetryState: IncidentState = {
      ...failedState,
      retryCount: 3,
    };
    expect(routeAfterSandbox(maxRetryState)).toBe("humanGateNode");

    const successState: IncidentState = {
      ...failedState,
      sandboxResult: {
        ...failedState.sandboxResult!,
        exitCode: 0,
        success: true,
      },
      retryCount: 1,
    };
    expect(routeAfterSandbox(successState)).toBe("humanGateNode");
  });

  it("prNode enforces human approval gate invariant", async () => {
    const unapprovedState: IncidentState = {
      incidentId: "inc-unapproved",
      alert: sampleAlert,
      logs: [],
      metrics: {},
      hypothesis: "Cause",
      patchDiff: "--- diff",
      sandboxResult: null,
      humanApproved: false,
      retryCount: 0,
    };

    expect(prNode(unapprovedState)).rejects.toThrow(
      "Cannot execute Tier 3 state-mutating PR node without human approval"
    );

    const approvedState: IncidentState = {
      ...unapprovedState,
      humanApproved: true,
    };

    const outcome = await prNode(approvedState);
    expect(outcome.logs?.[0]).toContain("Remediation branch created");
  });

  it("completes full workflow and resumes with human approval command", async () => {
    const memorySaver = new MemorySaver();
    const graph = compileRemediationGraph(memorySaver);
    const incidentId = "full-workflow-test-01";
    const threadConfig = { configurable: { thread_id: incidentId } };

    await graph.invoke(
      {
        incidentId,
        alert: sampleAlert,
      },
      threadConfig
    );

    const stateBeforeApproval = await graph.getState(threadConfig);
    expect(stateBeforeApproval.next).toContain("humanGateNode");
    expect(stateBeforeApproval.values.humanApproved).toBe(false);

    const resumeCommand = new Command({
      resume: {
        approved: true,
        comment: "LGTM verified in staging",
        reviewer: "oncall-engineer",
      },
    });

    await graph.invoke(resumeCommand as Parameters<typeof graph.invoke>[0], threadConfig);

    const stateAfterApproval = await graph.getState(threadConfig);
    expect(stateAfterApproval.values.humanApproved).toBe(true);
    expect(stateAfterApproval.next).toHaveLength(0);
  });
});
