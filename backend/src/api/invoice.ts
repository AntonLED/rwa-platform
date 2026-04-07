import { Router } from "express";
import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import {
  createInvoice,
  getInvoice,
  getAllInvoices,
  advanceToCreditor,
  settleInvoice,
  markDefault,
} from "../lib/solana";
import { getDocumentHashBytes } from "../lib/edo";
import logger from "../lib/logger";

export const invoiceRouter = Router();

// ── Helpers ───────────────────────────────────────────────────────────────

const STATUS_MAP: Record<number, string> = {
  0: "Funding",
  1: "Funded",
  2: "Advanced",
  3: "Repaid",
  4: "Defaulted",
};

function formatInvoice(raw: any) {
  // Anchor enums come as objects like { funding: {} } or as numbers
  let status: string;
  if (typeof raw.status === "object" && raw.status !== null) {
    status = Object.keys(raw.status)[0];
    status = status.charAt(0).toUpperCase() + status.slice(1);
  } else {
    status = STATUS_MAP[raw.status] ?? String(raw.status);
  }

  return {
    invoiceId: raw.invoiceId,
    totalAmount: raw.totalAmount?.toString(),
    fundedAmount: raw.fundedAmount?.toString(),
    totalSeniorFunded: raw.totalSeniorFunded?.toString(),
    seniorClaimed: raw.seniorClaimed?.toString(),
    creditor: raw.creditor?.toString(),
    debtor: raw.debtor?.toString(),
    dueDate: raw.dueDate?.toNumber?.() ?? raw.dueDate,
    createdAt: raw.createdAt?.toNumber?.() ?? raw.createdAt,
    interestRateBps: raw.interestRateBps,
    documentHash: Buffer.from(raw.documentHash).toString("hex"),
    advancePaid: raw.advancePaid,
    status,
    authority: raw.authority?.toString(),
    mint: raw.mint?.toString(),
  };
}

// ── POST /api/invoices — создание инвойса ─────────────────────────────────

// Interest rate: platform calculates based on amount (MVP: fixed 7%)
const INTEREST_RATE_BPS = 700;

const CreateInvoiceSchema = z.object({
  creditorWallet: z.string().min(32).max(44),
  debtorName: z.string().min(1).max(100),
  amount: z.number().positive(),
  dueDate: z.string().or(z.number()),
  documentBase64: z.string().min(1),
});

invoiceRouter.post("/api/invoices", async (req, res) => {
  const parsed = CreateInvoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }

  const { creditorWallet, debtorName, amount, dueDate, documentBase64 } = parsed.data;

  try {
    const creditor = new PublicKey(creditorWallet);
    const debtor = PublicKey.default;

    const dueDateUnix =
      typeof dueDate === "number" ? dueDate : Math.floor(new Date(dueDate).getTime() / 1000);

    const documentHash = getDocumentHashBytes(documentBase64);
    const invoiceId = `INV-${Date.now()}`;

    // amount is in USDT (6 decimals)
    const amountLamports = Math.floor(amount * 1_000_000);

    const { tx, mint } = await createInvoice(
      invoiceId,
      amountLamports,
      creditor,
      debtor,
      dueDateUnix,
      INTEREST_RATE_BPS,
      documentHash
    );

    logger.info(`Invoice created: ${invoiceId}, tx=${tx}`);
    res.json({
      invoiceId,
      tx,
      mint: mint.toString(),
      totalAmount: amountLamports,
      creditor: creditorWallet,
      debtorName,
      interestRateBps: INTEREST_RATE_BPS,
      documentHash: Buffer.from(documentHash).toString("hex"),
    });
  } catch (err: any) {
    logger.error("Create invoice error", err);
    res.status(500).json({ error: err.message ?? "Failed to create invoice" });
  }
});

// ── GET /api/invoices — список всех инвойсов ──────────────────────────────

invoiceRouter.get("/api/invoices", async (_req, res) => {
  try {
    const raw = await getAllInvoices();
    const invoices = raw.map((item: any) => ({
      publicKey: item.publicKey.toString(),
      ...formatInvoice(item.account),
    }));
    res.json({ invoices });
  } catch (err: any) {
    logger.error("Get all invoices error", err);
    res.status(500).json({ error: err.message ?? "Failed to fetch invoices" });
  }
});

// ── GET /api/invoices/:id — детали инвойса ────────────────────────────────

invoiceRouter.get("/api/invoices/:id", async (req, res) => {
  try {
    const raw = await getInvoice(req.params.id);
    if (!raw) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }
    res.json(formatInvoice(raw));
  } catch (err: any) {
    logger.error("Get invoice error", err);
    res.status(500).json({ error: err.message ?? "Failed to fetch invoice" });
  }
});

// ── POST /api/invoices/:id/advance — аванс 90% кредитору ─────────────────

invoiceRouter.post("/api/invoices/:id/advance", async (req, res) => {
  try {
    const tx = await advanceToCreditor(req.params.id);
    logger.info(`Invoice advanced: ${req.params.id}, tx=${tx}`);
    res.json({ tx, invoiceId: req.params.id, action: "advance" });
  } catch (err: any) {
    logger.error("Advance error", err);
    res.status(500).json({ error: err.message ?? "Failed to advance" });
  }
});

// ── POST /api/invoices/:id/settle — подтверждение оплаты ──────────────────

invoiceRouter.post("/api/invoices/:id/settle", async (req, res) => {
  try {
    const tx = await settleInvoice(req.params.id);
    logger.info(`Invoice settled: ${req.params.id}, tx=${tx}`);
    res.json({ tx, invoiceId: req.params.id, action: "settle" });
  } catch (err: any) {
    logger.error("Settle error", err);
    res.status(500).json({ error: err.message ?? "Failed to settle" });
  }
});

// ── POST /api/invoices/:id/default — дефолт ──────────────────────────────

invoiceRouter.post("/api/invoices/:id/default", async (req, res) => {
  try {
    const tx = await markDefault(req.params.id);
    logger.info(`Invoice defaulted: ${req.params.id}, tx=${tx}`);
    res.json({ tx, invoiceId: req.params.id, action: "default" });
  } catch (err: any) {
    logger.error("Default error", err);
    res.status(500).json({ error: err.message ?? "Failed to mark default" });
  }
});
