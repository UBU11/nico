import { pgTable, text, timestamp, jsonb, serial } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { incidents } from "./incidents";

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  incidentId: text("incident_id")
    .notNull()
    .references(() => incidents.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  details: jsonb("details").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs);
export const selectAuditLogSchema = createSelectSchema(auditLogs);

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
