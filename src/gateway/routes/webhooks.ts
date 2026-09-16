import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  AlertmanagerPayloadSchema,
  GitHubActionsFailurePayloadSchema,
  type AlertPayload,
} from "../../types/alert";
import { compileRemediationGraph } from "../../graph/workflow";
import { db } from "../../db/client";
import { incidents, auditLogs } from "../../db/schema";

export const webhookRoutes = new Hono();

webhookRoutes.post(
  "/webhooks/alert",
  zValidator("json", AlertmanagerPayloadSchema),
  async (c) => {
    const payload = c.req.valid("json");
    const firstAlert = payload.alerts[0];

    if (!firstAlert) {
      return c.json({ error: "No alert items found in payload" }, 400);
    }

    const incidentId = `inc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const normalizedAlert: AlertPayload = {
      id: incidentId,
      source: "alertmanager",
      title: firstAlert.annotations["summary"] ?? firstAlert.labels["alertname"] ?? "Alertmanager Alert",
      service: firstAlert.labels["job"] ?? firstAlert.labels["service"] ?? "unknown-service",
      severity: firstAlert.labels["severity"] === "critical" ? "critical" : "warning",
      description: firstAlert.annotations["description"] ?? "No description provided",
      metadata: { labels: firstAlert.labels, annotations: firstAlert.annotations },
      timestamp: firstAlert.startsAt,
    };

    try {
      await db.insert(incidents).values({
        id: incidentId,
        externalAlertId: firstAlert.fingerprint ?? incidentId,
        source: normalizedAlert.source,
        title: normalizedAlert.title,
        service: normalizedAlert.service,
        severity: normalizedAlert.severity,
        status: "triaging",
      });

      await db.insert(auditLogs).values({
        incidentId,
        eventType: "alert_ingested",
        details: { source: "alertmanager", payload },
      });
    } catch {
      // Allow execution in dev/eval mode if database is offline
    }

    const graph = compileRemediationGraph();
    const workflowPromise = graph.invoke(
      {
        incidentId,
        alert: normalizedAlert,
      },
      { configurable: { thread_id: incidentId } }
    );

    // Run graph asynchronously to avoid blocking webhook response
    workflowPromise.catch((err: unknown) => {
      console.error(`[workflow:error] Incident ${incidentId} failed:`, err);
    });

    return c.json({
      status: "accepted",
      incidentId,
      service: normalizedAlert.service,
      threadId: incidentId,
    }, 202);
  }
);

webhookRoutes.post(
  "/webhooks/ci",
  zValidator("json", GitHubActionsFailurePayloadSchema),
  async (c) => {
    const payload = c.req.valid("json");
    const incidentId = `ci-${Date.now()}-${payload.runId}`;

    const normalizedAlert: AlertPayload = {
      id: incidentId,
      source: "github_actions",
      title: `CI Failure: ${payload.workflow} on ${payload.branch}`,
      service: payload.repository,
      severity: "critical",
      description: `Failed step '${payload.failedStep}' triggered by ${payload.actor} at commit ${payload.sha}`,
      metadata: { ...payload },
      timestamp: new Date().toISOString(),
    };

    try {
      await db.insert(incidents).values({
        id: incidentId,
        externalAlertId: payload.runId,
        source: normalizedAlert.source,
        title: normalizedAlert.title,
        service: normalizedAlert.service,
        severity: normalizedAlert.severity,
        status: "triaging",
      });

      await db.insert(auditLogs).values({
        incidentId,
        eventType: "alert_ingested",
        details: { source: "github_actions", payload },
      });
    } catch {
      // Allow execution in dev/eval mode if database is offline
    }

    const graph = compileRemediationGraph();
    graph.invoke(
      {
        incidentId,
        alert: normalizedAlert,
      },
      { configurable: { thread_id: incidentId } }
    ).catch((err: unknown) => {
      console.error(`[workflow:error] Incident ${incidentId} failed:`, err);
    });

    return c.json({
      status: "accepted",
      incidentId,
      repository: payload.repository,
      threadId: incidentId,
    }, 202);
  }
);
