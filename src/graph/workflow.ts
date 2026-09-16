import { StateGraph, START, END, type BaseCheckpointSaver } from "@langchain/langgraph";
import { IncidentStateAnnotation, type IncidentState } from "./state";
import {
  triageNode,
  queryNode,
  hypothesisNode,
  sandboxNode,
  humanGateNode,
  prNode,
} from "./nodes";
import { checkpointer } from "../db/checkpointer";

const MAX_RETRY_ATTEMPTS = 3;

export function routeAfterSandbox(state: IncidentState): "hypothesisNode" | "humanGateNode" {
  const isFailure = state.sandboxResult !== null && !state.sandboxResult.success;
  if (isFailure && state.retryCount < MAX_RETRY_ATTEMPTS) {
    return "hypothesisNode";
  }
  return "humanGateNode";
}

export function routeAfterGate(state: IncidentState): "prNode" | typeof END {
  if (state.humanApproved) {
    return "prNode";
  }
  return END;
}

export function createRemediationWorkflow() {
  return new StateGraph(IncidentStateAnnotation)
    .addNode("triageNode", triageNode)
    .addNode("queryNode", queryNode)
    .addNode("hypothesisNode", hypothesisNode)
    .addNode("sandboxNode", sandboxNode)
    .addNode("humanGateNode", humanGateNode)
    .addNode("prNode", prNode)
    .addEdge(START, "triageNode")
    .addEdge("triageNode", "queryNode")
    .addEdge("queryNode", "hypothesisNode")
    .addEdge("hypothesisNode", "sandboxNode")
    .addConditionalEdges("sandboxNode", routeAfterSandbox, {
      hypothesisNode: "hypothesisNode",
      humanGateNode: "humanGateNode",
    })
    .addConditionalEdges("humanGateNode", routeAfterGate, {
      prNode: "prNode",
      [END]: END,
    })
    .addEdge("prNode", END);
}

export function compileRemediationGraph(saver: BaseCheckpointSaver = checkpointer) {
  return createRemediationWorkflow().compile({ checkpointer: saver });
}
