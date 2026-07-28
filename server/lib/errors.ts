import type { Response } from "express";

export function sendError(res: Response, status: number, code: string, message: string) {
  res.status(status).json({ error: { code, message } });
}

export const notFound = (res: Response, message = "Not found") =>
  sendError(res, 404, "NOT_FOUND", message);

export const validationError = (res: Response, message: string) =>
  sendError(res, 400, "VALIDATION_ERROR", message);
