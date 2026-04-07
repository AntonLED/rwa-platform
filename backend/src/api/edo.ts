import { Router } from "express";
import { z } from "zod";
import { mockEdoInvoices, validateDocument } from "../lib/edo";
import logger from "../lib/logger";

export const edoRouter = Router();

// GET /api/edo/invoices — список мок-инвойсов из EDO
edoRouter.get("/api/edo/invoices", (_req, res) => {
  res.json({ invoices: mockEdoInvoices });
});

// POST /api/edo/validate — валидация документа
const ValidateBodySchema = z.object({
  documentBase64: z.string().min(1, "documentBase64 is required"),
});

edoRouter.post("/api/edo/validate", (req, res) => {
  const parsed = ValidateBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }

  try {
    const result = validateDocument(parsed.data.documentBase64);
    res.json(result);
  } catch (err: any) {
    logger.error("EDO validate error", err);
    res.status(400).json({ error: "Invalid base64 document" });
  }
});
