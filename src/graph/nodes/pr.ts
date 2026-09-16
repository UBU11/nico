import type { IncidentState } from "../state";

export interface PullRequestOutcome {
  branch: string;
  pullRequestUrl: string;
  created: boolean;
}

export async function createRemediationPullRequest(state: IncidentState): Promise<PullRequestOutcome> {
  const branchName = `remediation/incident-${state.incidentId.toLowerCase()}`;
  return {
    branch: branchName,
    pullRequestUrl: `https://github.com/org/repo/pull/mock-${state.incidentId}`,
    created: true,
  };
}

export async function prNode(state: IncidentState): Promise<Partial<IncidentState>> {
  if (!state.humanApproved) {
    throw new Error("Cannot execute Tier 3 state-mutating PR node without human approval");
  }

  const outcome = await createRemediationPullRequest(state);

  return {
    logs: [
      `[pr] Remediation branch created: ${outcome.branch}`,
      `[pr] Pull request opened: ${outcome.pullRequestUrl}`,
    ],
  };
}
