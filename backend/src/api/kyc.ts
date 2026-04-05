import { Router, Request, Response } from "express";
import { z } from "zod";
import { createApplicant, createAccessToken } from "../lib/sumsub";
import logger from "../lib/logger";

export const kycRouter = Router();

const TokenBodySchema = z.object({
  walletAddress: z.string().min(32).max(44),
  levelName: z.string().optional().default("basic-kyc-level"),
});

/**
 * POST /api/kyc/token
 * Фронтенд вызывает этот endpoint, чтобы получить SDK-токен
 * для встраивания Sumsub WebSDK iframe.
 */
kycRouter.post("/api/kyc/token", async (req: Request, res: Response) => {
  const parsed = TokenBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { walletAddress, levelName } = parsed.data;

  try {
    // Создаём applicant (идемпотентно — Sumsub вернёт существующего по externalUserId)
    const applicant = await createApplicant(walletAddress, levelName);
    logger.info(`Applicant created/fetched: ${applicant.id} for wallet ${walletAddress}`);

    // Получаем короткоживущий SDK-токен (TTL 10 мин)
    const { token } = await createAccessToken(applicant.id, levelName);
    res.json({ token, applicantId: applicant.id });
  } catch (e: any) {
    logger.error(`KYC token error: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});
