import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { useCallback, useMemo, useState } from "react";
import idl from "../idl/rwa_token.json";
import type { Invoice } from "./useInvoice";

const PROGRAM_ID = new PublicKey("J5zLwZs3qmKv69Xd2eGmvbGf8PuCtKD5bh22dm9iZHre");
const INVESTOR_SEED = Buffer.from("investor");

export interface InvestorPosition {
  invoiceId: string;
  amount: string;
  fundedAt: number;
  claimed: boolean;
  pda: string;
}

export function useInvestorPositions() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [positions, setPositions] = useState<InvestorPosition[]>([]);
  const [loading, setLoading] = useState(false);

  const program = useMemo(() => {
    if (!wallet.publicKey) return null;
    const provider = new AnchorProvider(connection, wallet as any, {});
    return new Program(idl as any, provider);
  }, [connection, wallet.publicKey]);

  const fetchPositions = useCallback(
    async (invoices: Invoice[]) => {
      if (!program || !wallet.publicKey) return;
      setLoading(true);
      try {
        const results: InvestorPosition[] = [];
        for (const inv of invoices) {
          const [pda] = PublicKey.findProgramAddressSync(
            [INVESTOR_SEED, Buffer.from(inv.invoiceId), wallet.publicKey.toBuffer()],
            PROGRAM_ID
          );
          try {
            const pos = await (program.account as any).investorPosition.fetch(pda);
            results.push({
              invoiceId: pos.invoiceId,
              amount: pos.amount.toString(),
              fundedAt: pos.fundedAt?.toNumber?.() ?? pos.fundedAt,
              claimed: pos.claimed,
              pda: pda.toString(),
            });
          } catch {
            // No position for this invoice — skip
          }
        }
        setPositions(results);
      } finally {
        setLoading(false);
      }
    },
    [program, wallet.publicKey]
  );

  return { positions, loading, fetchPositions };
}
