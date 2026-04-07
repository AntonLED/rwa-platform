import { Router, Request, Response } from "express";
import { PublicKey } from "@solana/web3.js";
import { z } from "zod";
import { getWhitelistEntry, getAllWhitelistEntries, removeFromWhitelist } from "../lib/solana";
import logger from "../lib/logger";

export const whitelistRouter = Router();

/**
 * GET /api/whitelist/:wallet
 * Возвращает KYC-статус кошелька из on-chain PDA.
 */
whitelistRouter.get("/api/whitelist/:wallet", async (req: Request, res: Response) => {
  const { wallet } = req.params;

  let pubkey: PublicKey;
  try {
    pubkey = new PublicKey(wallet);
  } catch {
    return res.status(400).json({ error: "Invalid wallet address" });
  }

  try {
    const entry = await getWhitelistEntry(pubkey);
    if (!entry) {
      return res.json({ whitelisted: false, active: false });
    }
    res.json({
      whitelisted: true,
      active: entry.isActive,
      kycId: entry.kycId,
      countryCode: entry.countryCode,
      whitelistedAt: entry.whitelistedAt.toNumber(),
    });
  } catch (e: any) {
    logger.error(`Whitelist check error: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/whitelist
 * Возвращает список всех KYC-записей (для Admin UI).
 */
whitelistRouter.get("/api/whitelist", async (_req: Request, res: Response) => {
  try {
    const entries = await getAllWhitelistEntries();
    res.json({ entries });
  } catch (e: any) {
    logger.error(`Get all whitelist error: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

const RevokeSchema = z.object({
  reason: z.string().min(1).max(128),
});

/**
 * POST /api/whitelist/:wallet/revoke
 * Отзывает KYC для указанного кошелька.
 */
whitelistRouter.post("/api/whitelist/:wallet/revoke", async (req: Request, res: Response) => {
  const { wallet } = req.params;
  const parsed = RevokeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
  }

  let pubkey: PublicKey;
  try {
    pubkey = new PublicKey(wallet);
  } catch {
    return res.status(400).json({ error: "Invalid wallet address" });
  }

  try {
    const tx = await removeFromWhitelist(pubkey, parsed.data.reason);
    logger.info(`Wallet revoked: ${wallet}, tx=${tx}`);
    res.json({ tx, wallet, revoked: true });
  } catch (e: any) {
    logger.error(`Revoke whitelist error: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});
