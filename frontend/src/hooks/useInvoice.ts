import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { useCallback, useMemo, useState } from "react";
import idl from "../idl/rwa_token.json";

const PROGRAM_ID = new PublicKey("GH9TPWVqa4UVNARHFBXadN5uwLMrhtE6obaHC9LFCKFz");
// Devnet USDT mint — replace with real USDT mint for mainnet
// export const USDT_MINT = new PublicKey("JD2RSTTxd6YEqak253jD4sq8L15xjBV3oSm9DHHSywQg");
export const USDT_MINT = new PublicKey("JD2RSTTxd6YEqak253jD4sq8L15xjBV3oSm9DHHSywQg");
const INVOICE_SEED = Buffer.from("invoice");
const INVESTOR_SEED = Buffer.from("investor");

export interface Invoice {
  publicKey: string;
  invoiceId: string;
  totalAmount: string;
  fundedAmount: string;
  creditor: string;
  debtor: string;
  dueDate: number;
  createdAt: number;
  interestRateBps: number;
  riskLevel: number;
  documentHash: string;
  advancePaid: boolean;
  status: string;
  authority: string;
  mint: string;
}

export function useInvoiceProgram() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [loading, setLoading] = useState(false);

  const program = useMemo(() => {
    if (!wallet.publicKey) return null;
    const provider = new AnchorProvider(connection, wallet as any, {});
    return new Program(idl as any, provider);
  }, [connection, wallet.publicKey]);

  const fetchAllInvoices = useCallback(async (): Promise<Invoice[]> => {
    const res = await fetch("/api/invoices");
    const data = await res.json();
    return data.invoices || [];
  }, []);

  const fetchInvoice = useCallback(async (invoiceId: string): Promise<Invoice | null> => {
    const res = await fetch(`/api/invoices/${invoiceId}`);
    if (!res.ok) return null;
    return res.json();
  }, []);

  const fundInvoice = useCallback(
    async (invoiceId: string, amount: number, usdtMint: PublicKey, invoiceMint: PublicKey) => {
      if (!program || !wallet.publicKey) throw new Error("Wallet not connected");
      setLoading(true);
      try {
        const [invoicePda] = PublicKey.findProgramAddressSync(
          [INVOICE_SEED, Buffer.from(invoiceId)],
          PROGRAM_ID
        );
        const [investorPosition] = PublicKey.findProgramAddressSync(
          [INVESTOR_SEED, Buffer.from(invoiceId), wallet.publicKey.toBuffer()],
          PROGRAM_ID
        );

        const investorUsdt = getAssociatedTokenAddressSync(
          usdtMint, wallet.publicKey, false, TOKEN_2022_PROGRAM_ID
        );
        const invoiceVault = getAssociatedTokenAddressSync(
          usdtMint, invoicePda, true, TOKEN_2022_PROGRAM_ID
        );
        const investorInvoiceTokens = getAssociatedTokenAddressSync(
          invoiceMint, wallet.publicKey, false, TOKEN_2022_PROGRAM_ID
        );

        // Create ATAs that may not exist yet (vault for invoice PDA, investor invoice tokens)
        const preIxs = [];
        const conn = program.provider.connection;

        for (const { mint, owner, ata } of [
          { mint: usdtMint, owner: invoicePda, ata: invoiceVault },
          { mint: invoiceMint, owner: wallet.publicKey, ata: investorInvoiceTokens },
        ]) {
          const info = await conn.getAccountInfo(ata);
          if (!info) {
            preIxs.push(
              createAssociatedTokenAccountInstruction(
                wallet.publicKey, ata, owner, mint,
                TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
              )
            );
          }
        }

        const tx = await program.methods
          .fundInvoice(invoiceId, new BN(amount))
          .accounts({
            invoice: invoicePda,
            usdtMint,
            investorUsdt,
            invoiceVault,
            invoiceMint,
            investorInvoiceTokens,
            investorPosition,
            investor: wallet.publicKey,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .preInstructions(preIxs)
          .rpc();
        return tx;
      } finally {
        setLoading(false);
      }
    },
    [program, wallet.publicKey]
  );

  const claimReturns = useCallback(
    async (invoiceId: string, usdtMint: PublicKey, invoiceMint: PublicKey) => {
      if (!program || !wallet.publicKey) throw new Error("Wallet not connected");
      setLoading(true);
      try {
        const [invoicePda] = PublicKey.findProgramAddressSync(
          [INVOICE_SEED, Buffer.from(invoiceId)],
          PROGRAM_ID
        );
        const [investorPosition] = PublicKey.findProgramAddressSync(
          [INVESTOR_SEED, Buffer.from(invoiceId), wallet.publicKey.toBuffer()],
          PROGRAM_ID
        );

        const investorUsdt = getAssociatedTokenAddressSync(
          usdtMint, wallet.publicKey, false, TOKEN_2022_PROGRAM_ID
        );
        const invoiceVault = getAssociatedTokenAddressSync(
          usdtMint, invoicePda, true, TOKEN_2022_PROGRAM_ID
        );
        const investorInvoiceTokens = getAssociatedTokenAddressSync(
          invoiceMint, wallet.publicKey, false, TOKEN_2022_PROGRAM_ID
        );

        const tx = await program.methods
          .claim(invoiceId)
          .accounts({
            invoice: invoicePda,
            invoiceMint,
            investorInvoiceTokens,
            usdtMint,
            invoiceVault,
            investorUsdt,
            investorPosition,
            investor: wallet.publicKey,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .rpc();
        return tx;
      } finally {
        setLoading(false);
      }
    },
    [program, wallet.publicKey]
  );

  return { program, fetchAllInvoices, fetchInvoice, fundInvoice, claimReturns, loading };
}
