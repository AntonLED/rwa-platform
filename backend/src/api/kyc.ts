import { Router, Request, Response } from "express";
import { PublicKey } from "@solana/web3.js";
import { z } from "zod";
import { createApplicant, createAccessToken } from "../lib/sumsub";
import { addToWhitelist } from "../lib/solana";
import logger from "../lib/logger";

export const kycRouter = Router();

const TokenBodySchema = z.object({
  walletAddress: z.string().min(32).max(44),
  levelName: z.string().optional().default("basic-kyc-level"),
});

function isSumsubMock(): boolean {
  const token = process.env.SUMSUB_APP_TOKEN ?? "";
  return !token || token.startsWith("<");
}

/**
 * POST /api/kyc/token
 * Фронтенд вызывает этот endpoint, чтобы получить SDK-токен
 * для встраивания Sumsub WebSDK iframe.
 *
 * В mock-режиме (SUMSUB_APP_TOKEN не задан) — сразу вайтлистит кошелёк on-chain.
 */
kycRouter.post("/api/kyc/token", async (req: Request, res: Response) => {
  const parsed = TokenBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { walletAddress, levelName } = parsed.data;

  // ── Mock mode: skip Sumsub, whitelist on-chain immediately ──
  if (isSumsubMock()) {
    logger.info(`[MOCK KYC] Whitelisting wallet ${walletAddress} directly`);
    try {
      const wallet = new PublicKey(walletAddress);
      const tx = await addToWhitelist(wallet, `mock-kyc-${walletAddress.slice(0, 8)}`, "KZ");
      logger.info(`[MOCK KYC] Wallet ${walletAddress} whitelisted, tx=${tx}`);
      return res.json({ mock: true, whitelisted: true, tx });
    } catch (e: any) {
      logger.error(`[MOCK KYC] Whitelist error: ${e.message}`);
      return res.status(500).json({ error: e.message });
    }
  }

  // ── Real Sumsub flow ──
  try {
    const applicant = await createApplicant(walletAddress, levelName);
    logger.info(`Applicant created/fetched: ${applicant.id} for wallet ${walletAddress}`);

    const { token } = await createAccessToken(applicant.id, levelName);
    res.json({ token, applicantId: applicant.id });
  } catch (e: any) {
    logger.error(`KYC token error: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});
