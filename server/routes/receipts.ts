import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { getObjectStorage } from "../lib/objectStorage";
import { extractReceiptData } from "../lib/receiptExtraction";
import { validationError } from "../lib/errors";

export const receiptsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image uploads are supported"));
      return;
    }
    cb(null, true);
  },
});

// The only endpoint here with a real per-request cost (a Gemini API call) —
// rate-limited per user. In-memory store, not Redis (same call as Stage 2's
// job scheduler): fine for this single-instance deployment.
const scanRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? ipKeyGenerator(req.ip ?? "unknown"),
});

receiptsRouter.post("/scan", scanRateLimit, upload.single("receipt"), async (req, res) => {
  if (!req.file) {
    validationError(res, "No file uploaded (expected a 'receipt' form field)");
    return;
  }

  try {
    const storage = getObjectStorage();
    const key = `receipts/${req.user!.id}/${Date.now()}-${req.file.originalname}`;
    const [receiptUrl, extracted] = await Promise.all([
      storage.put(key, req.file.buffer, req.file.mimetype),
      extractReceiptData(req.file.buffer, req.file.mimetype),
    ]);

    res.json({ data: { receiptUrl, extracted } });
  } catch (err) {
    console.error("[receipts] scan failed", err);
    res.status(502).json({ error: { code: "EXTRACTION_FAILED", message: "Could not process the receipt photo" } });
  }
});

receiptsRouter.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError || (err instanceof Error && err.message === "Only image uploads are supported")) {
    validationError(res, err.message);
    return;
  }
  next(err);
});
