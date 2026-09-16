import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { Command } from "@langchain/langgraph";
import { compileRemediationGraph } from "../../graph/workflow";
import { db } from "../../db/client";
import { incidents, auditLogs } from "../../db/schema";
import { eq } from "drizzle-orm";
import type { HumanApprovalResponse } from "../../graph/nodes/gate";

const ApprovePayloadSchema = z.object({
  approved: z.boolean(),
  comment: z.string().optional(),
  reviewer: z.string().default("operator"),
});

export const incidentRoutes = new Hono();

incidentRoutes.get("/incidents/:id", async (c) => {
  const incidentId = c.req.param("id");

  let dbIncident = null;
  try {
    const rows = await db.select().from(incidents).where(eq(incidents.id, incidentId)).limit(1);
    dbIncident = rows[0] ?? null;
  } catch {
    // Database might be unreachable in testing/offline mode
  }

  const graph = compileRemediationGraph();
  let threadState = null;
  try {
    threadState = await graph.getState({ configurable: { thread_id: incidentId } });
  } catch {
    // Checkpointer might not contain thread in unit tests
  }

  if (!dbIncident && !threadState?.values) {
    return c.json({ error: "Incident not found" }, 404);
  }

  return c.json({
    incident: dbIncident,
    graphState: threadState?.values ?? null,
    nextNodes: threadState?.next ?? [],
  });
});

incidentRoutes.post(
  "/incidents/:id/approve",
  zValidator("json", ApprovePayloadSchema),
  async (c) => {
    const incidentId = c.req.param("id");
    const { approved, comment, reviewer } = c.req.valid("json");

    try {
      await db.insert(auditLogs).values({
        incidentId,
        eventType: approved ? "gate_approved" : "gate_rejected",
        details: { approved, comment, reviewer },
      });
    } catch {
      // Offline fallback
    }

    const graph = compileRemediationGraph();
    const resumeCommand = new Command<HumanApprovalResponse>({
      resume: {
        approved,
        comment,
        reviewer,
      },
    });

    const resumePromise = graph.invoke(
      resumeCommand as Parameters<typeof graph.invoke>[0],
      { configurable: { thread_id: incidentId } }
    );

    resumePromise.catch((err: unknown) => {
      console.error(`[workflow:resume_error] Incident ${incidentId} failed:`, err);
    });

    return c.json({
      status: "resumed",
      incidentId,
      decision: approved ? "approved" : "rejected",
    });
  }
);
