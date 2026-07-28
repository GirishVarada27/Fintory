import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { auditLog } from "../db/schema";
import type * as schema from "../db/schema";

export type AuditEntityType = "expense" | "loan" | "savings_account" | "asset";
export type AuditAction = "create" | "update" | "delete";

export async function writeAuditLog(
  tx: NodePgDatabase<typeof schema>,
  userId: string,
  entityType: AuditEntityType,
  entityId: string,
  action: AuditAction,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): Promise<void> {
  await tx.insert(auditLog).values({
    userId,
    entityType,
    entityId,
    action,
    diff: { before, after },
  });
}
