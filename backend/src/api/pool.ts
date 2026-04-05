import { Router } from "express";
import { z } from "zod";
import { initializePool, getPoolConfig } from "../lib/solana";
import logger from "../lib/logger";

export const poolRouter = Router();

// GET /api/pools — конфиги обоих пулов
poolRouter.get("/api/pools", async (_req, res) => {
  const pools = [];

  for (const riskLevel of [0, 1]) {
    const config = await getPoolConfig(riskLevel);
    if (config) {
      pools.push({
        riskLevel: config.riskLevel,
        baseRateBps: config.baseRateBps,
        markupBps: config.markupBps,
        totalInvoices: config.totalInvoices?.toString() ?? "0",
        totalFunded: config.totalFunded?.toString() ?? "0",
        authority: config.authority?.toString(),
      });
    }
  }

  res.json({ pools });
});

// POST /api/pools/initialize — инициализация пула
const InitPoolSchema = z.object({
  riskLevel: z.number().int().min(0).max(1),
  baseRateBps: z.number().int().min(0).max(10000),
  markupBps: z.number().int().min(0).max(10000),
});

poolRouter.post("/api/pools/initialize", async (req, res) => {
  const parsed = InitPoolSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }

  const { riskLevel, baseRateBps, markupBps } = parsed.data;

  try {
    const tx = await initializePool(riskLevel, baseRateBps, markupBps);
    logger.info(`Pool initialized: riskLevel=${riskLevel}, tx=${tx}`);
    res.json({ tx, riskLevel, baseRateBps, markupBps });
  } catch (err: any) {
    logger.error("Pool init error", err);
    res.status(500).json({ error: err.message ?? "Failed to initialize pool" });
  }
});
