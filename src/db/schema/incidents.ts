import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const incidents = pgTable("incidents", {
  id: text("id").primaryKey(),
  externalAlertId: text("external_alert_id").notNull(),
  source: text("source").notNull(),
  title: text("title").notNull(),
  service: text("service").notNull(),
  severity: text("severity").notNull(),
  status: text("status").notNull().default("triaging"),
  hypothesis: text("hypothesis"),
  patchDiff: text("patch_diff"),
  retryCount: integer("retry_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertIncidentSchema = createInsertSchema(incidents);
export const selectIncidentSchema = createSelectSchema(incidents);

export type Incident = typeof incidents.$inferSelect;
export type NewIncident = typeof incidents.$inferInsert;
