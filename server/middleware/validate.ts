import type { Request, Response, NextFunction } from "express";
import type { ZodType } from "zod";
import { validationError } from "../lib/errors";

function formatIssues(error: { issues: { path: (string | number)[]; message: string }[] }): string {
  return error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
}

export function validateBody(schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      validationError(res, formatIssues(result.error));
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      validationError(res, formatIssues(result.error));
      return;
    }
    req.validatedQuery = result.data;
    next();
  };
}
