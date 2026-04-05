import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, Idl } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { useMemo } from "react";
// IDL подключается после `anchor build && yarn copy-idl`
// import idl from "../idl/rwa_token.json";

const PROGRAM_ID = new PublicKey("RWATo1111111111111111111111111111111111111111");
const INVOICE_SEED = Buffer.from("invoice");

export function useInvoiceProgram() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const program = useMemo(() => {
    if (!wallet.publicKey) return null;
    // Раскомментировать после копирования IDL:
    // const provider = new AnchorProvider(connection, wallet as any, {});
    // return new Program(idl as Idl, PROGRAM_ID, provider);
    return null;
  }, [connection, wallet.publicKey]);

  async function fetchInvoice(invoiceId: string) {
    if (!program) throw new Error("Program not loaded");
    const [pda] = PublicKey.findProgramAddressSync(
      [INVOICE_SEED, Buffer.from(invoiceId)],
      PROGRAM_ID
    );
    return (program.account as any).invoiceAccount.fetch(pda);
  }

  return { program, fetchInvoice };
}
