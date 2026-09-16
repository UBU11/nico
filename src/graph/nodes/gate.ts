import { interrupt } from "@langchain/langgraph";
import type { IncidentState } from "../state";

export interface HumanApprovalRequest {
  incidentId: string;
  hypothesis: string | null;
  patchDiff: string | null;
  sandboxSuccess: boolean;
  message: string;
}

export interface HumanApprovalResponse {
  approved: boolean;
  comment?: string;
  reviewer?: string;
}

export async function humanGateNode(state: IncidentState): Promise<Partial<IncidentState>> {
  const approvalRequest: HumanApprovalRequest = {
    incidentId: state.incidentId,
    hypothesis: state.hypothesis,
    patchDiff: state.patchDiff,
    sandboxSuccess: state.sandboxResult?.success ?? false,
    message: "Remediation patch requires human-in-the-loop review before Git mutating actions.",
  };

  const response = interrupt(approvalRequest) as HumanApprovalResponse | undefined;
  const isApproved = Boolean(response?.approved);

  return {
    humanApproved: isApproved,
    logs: [
      `[human-gate] Gate evaluated. Decision: ${isApproved ? "APPROVED" : "REJECTED"}${response?.comment ? ` Comment: ${response.comment}` : ""}`,
    ],
  };
}
