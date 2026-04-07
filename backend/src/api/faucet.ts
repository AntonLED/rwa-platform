import { Router } from "express";
import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { getConnection, getBackendKeypair } from "../lib/solana";
import logger from "../lib/logger";

export const faucetRouter = Router();

const FAUCET_AMOUNT = 10_000 * 1_000_000; // 10 000 USDT (6 decimals)

const FaucetSchema = z.object({
  wallet: z.string().min(32).max(44),
});

/**
 * POST /api/faucet
 * Mints mock USDT to any wallet — devnet only.
 */
faucetRouter.post("/api/faucet", async (req, res) => {
  const parsed = FaucetSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }

  const usdtMintAddress = process.env.USDT_MINT;
  if (!usdtMintAddress) {
    res.status(500).json({ error: "USDT_MINT not configured" });
    return;
  }

  let wallet: PublicKey;
  try {
    wallet = new PublicKey(parsed.data.wallet);
  } catch {
    res.status(400).json({ error: "Invalid wallet address" });
    return;
  }

  try {
    const connection = getConnection();
    const authority = getBackendKeypair();
    const usdtMint = new PublicKey(usdtMintAddress);

    const ata = await getOrCreateAssociatedTokenAccount(
      connection,
      authority,
      usdtMint,
      wallet,
      false,
      "confirmed",
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

    await mintTo(
      connection,
      authority,
      usdtMint,
      ata.address,
      authority,
      FAUCET_AMOUNT,
      [],
      { commitment: "confirmed" },
      TOKEN_2022_PROGRAM_ID
    );

    logger.info(`Faucet: minted ${FAUCET_AMOUNT / 1e6} USDT to ${wallet.toBase58()}`);
    res.json({ amount: FAUCET_AMOUNT / 1e6, wallet: wallet.toBase58() });
  } catch (err: any) {
    logger.error("Faucet error", err);
    res.status(500).json({ error: err.message ?? "Faucet failed" });
  }
});
