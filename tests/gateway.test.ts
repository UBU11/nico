import { describe, expect, it } from "bun:test";
import { app } from "../src/gateway/app";

describe("HTTP Gateway Routes & Zod Validation Tests", () => {
  it("GET /health returns 200 OK", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);

    const json = (await res.json()) as { status: string };
    expect(json.status).toBe("ok");
  });

  it("POST /webhooks/alert rejects payload without required alerts field", async () => {
    const res = await app.request("/webhooks/alert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invalid: "payload" }),
    });

    expect(res.status).toBe(400);
  });

  it("POST /webhooks/alert accepts valid Alertmanager payload", async () => {
    const validPayload = {
      receiver: "sre-agent-webhook",
      status: "firing",
      alerts: [
        {
          status: "firing",
          labels: { alertname: "HighErrorRate", job: "billing-api", severity: "critical" },
          annotations: { summary: "High 5xx error rate", description: "5xx errors exceed 5%" },
          startsAt: new Date().toISOString(),
        },
      ],
    };

    const res = await app.request("/webhooks/alert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPayload),
    });

    expect(res.status).toBe(202);
    const json = (await res.json()) as { status: string; incidentId: string; service: string };
    expect(json.status).toBe("accepted");
    expect(json.service).toBe("billing-api");
    expect(json.incidentId).toBeDefined();
  });
});
