import { Router, Request, Response } from "express";
import { PublicKey } from "@solana/web3.js";
import { getWhitelistEntry } from "../lib/solana";
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
