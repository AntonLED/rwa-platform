import { Router, Request, Response } from "express";
import { PublicKey } from "@solana/web3.js";
import { verifyWebhookSignature } from "../lib/sumsub";
import { addToWhitelist, removeFromWhitelist } from "../lib/solana";
import logger from "../lib/logger";

export const sumsubWebhookRouter = Router();

sumsubWebhookRouter.post("/webhook/sumsub", async (req: Request, res: Response) => {
  const sig = req.headers["x-payload-digest"] as string;
  const rawBody = JSON.stringify(req.body);

  if (!verifyWebhookSignature(rawBody, sig)) {
    logger.warn("Invalid Sumsub webhook signature");
    return res.status(401).json({ error: "Invalid signature" });
  }

  const { type, reviewResult, externalUserId, applicantId } = req.body;
  // externalUserId = solana wallet address (задаётся при createApplicant)
  logger.info(`Sumsub webhook: type=${type}, externalUserId=${externalUserId}`);

  if (type === "applicantReviewed") {
    let wallet: PublicKey;
    try {
      wallet = new PublicKey(externalUserId);
    } catch {
      logger.error(`Invalid wallet address: ${externalUserId}`);
      return res.status(400).json({ error: "Invalid wallet address" });
    }

    const answer = reviewResult?.reviewAnswer;
    const country = req.body?.info?.country ?? "XX";

    if (answer === "GREEN") {
      // KYC пройден — добавляем в on-chain whitelist
      try {
        const tx = await addToWhitelist(wallet, applicantId, country);
        logger.info(`Wallet ${externalUserId} whitelisted. tx=${tx}`);
      } catch (e) {
        logger.error(`Failed to whitelist ${externalUserId}: ${e}`);
        return res.status(500).json({ error: "Blockchain tx failed" });
      }
    } else if (answer === "RED") {
      // KYC отклонён или санкции — отзываем из whitelist
      const rejectLabels: string[] = reviewResult?.rejectLabels ?? [];
      const reason = rejectLabels.join(",") || "kyc_rejected";
      try {
        await removeFromWhitelist(wallet, reason);
        logger.info(`Wallet ${externalUserId} removed from whitelist. reason=${reason}`);
      } catch (e) {
        // Может не быть в вайтлисте — не критично
        logger.warn(`removeFromWhitelist skipped for ${externalUserId}: ${e}`);
      }
    }
  }

  res.json({ ok: true });
});
