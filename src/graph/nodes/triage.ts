import type { IncidentState } from "../state";
import { CanonicalAlertSchema } from "../../types/alert";

function scrubSensitiveData(text: string): string {
  return text
    .replace(/(bearer\s+)[a-zA-Z0-9_\-\.]+/gi, "$1[REDACTED]")
    .replace(/(password\s*[:=]\s*)[^\s,;]+/gi, "$1[REDACTED]")
    .replace(/(api[_-]?key\s*[:=]\s*)[^\s,;]+/gi, "$1[REDACTED]")
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[REDACTED_EMAIL]");
}

export async function triageNode(state: IncidentState): Promise<Partial<IncidentState>> {
  const validatedAlert = CanonicalAlertSchema.parse(state.alert);
  const scrubbedDescription = scrubSensitiveData(validatedAlert.description);
  const scrubbedTitle = scrubSensitiveData(validatedAlert.title);

  const sanitizedAlert = {
    ...validatedAlert,
    title: scrubbedTitle,
    description: scrubbedDescription,
  };

  return {
    alert: sanitizedAlert,
    logs: [`[triage] Alert ${sanitizedAlert.id} triaged for service ${sanitizedAlert.service} with severity ${sanitizedAlert.severity}`],
  };
}
