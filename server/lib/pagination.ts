import { and, eq, lt, or, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

export interface Cursor {
  createdAt: string;
  id: string;
}

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeCursor(raw: string | undefined): Cursor | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as Cursor).createdAt === "string" &&
      typeof (parsed as Cursor).id === "string"
    ) {
      return parsed as Cursor;
    }
    return null;
  } catch {
    return null;
  }
}

// Keyset pagination on (created_at desc, id desc) — stable ordering even
// though uuid PKs aren't themselves sortable by insertion order.
export function cursorCondition(
  createdAtCol: PgColumn,
  idCol: PgColumn,
  cursor: Cursor | null,
): SQL | undefined {
  if (!cursor) return undefined;
  const cursorDate = new Date(cursor.createdAt);
  return or(
    lt(createdAtCol, cursorDate),
    and(eq(createdAtCol, cursorDate), lt(idCol, cursor.id)),
  );
}
