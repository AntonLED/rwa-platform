import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import {
  AnchorProvider,
  Program,
  Wallet,
  BN,
} from "@coral-xyz/anchor";
import * as bs58 from "bs58";
import * as fs from "fs";
import * as path from "path";

// Загружаем IDL после `anchor build`
// Пока используем any, до первого билда
let idl: any;
try {
  idl = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../idl/rwa_token.json"), "utf-8")
  );
} catch {
  console.warn("IDL not found — run `anchor build` first, then `yarn copy-idl`");
}

const PROGRAM_ID = new PublicKey(
  process.env.PROGRAM_ID ?? "RWATo1111111111111111111111111111111111111111"
);

export const WHITELIST_REGISTRY_SEED = Buffer.from("whitelist_registry");
export const WHITELIST_ENTRY_SEED = Buffer.from("whitelist_entry");
export const INVOICE_SEED = Buffer.from("invoice");

// ── Синглтон connection + program ──────────────────────────────────────────
let _program: Program | null = null;
let _connection: Connection | null = null;

export function getConnection(): Connection {
  if (!_connection) {
    _connection = new Connection(
      process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
      "confirmed"
    );
  }
  return _connection;
}

export function getBackendKeypair(): Keypair {
  const raw = process.env.BACKEND_PRIVATE_KEY;
  if (!raw) throw new Error("BACKEND_PRIVATE_KEY not set");
  const decoded = Buffer.from(raw, "base64");
  return Keypair.fromSecretKey(decoded);
}

export function getProgram(): Program {
  if (!idl) throw new Error("IDL not loaded — build the Anchor program first");
  if (!_program) {
    const connection = getConnection();
    const keypair = getBackendKeypair();
    const wallet = new Wallet(keypair);
    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
    _program = new Program(idl, PROGRAM_ID, provider);
  }
  return _program;
}

// ── PDA helpers ────────────────────────────────────────────────────────────

export function getWhitelistRegistryPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [WHITELIST_REGISTRY_SEED],
    PROGRAM_ID
  );
}

export function getWhitelistEntryPDA(wallet: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [WHITELIST_ENTRY_SEED, wallet.toBuffer()],
    PROGRAM_ID
  );
}

export function getInvoicePDA(invoiceId: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [INVOICE_SEED, Buffer.from(invoiceId)],
    PROGRAM_ID
  );
}

// ── On-chain операции ──────────────────────────────────────────────────────

export async function addToWhitelist(
  wallet: PublicKey,
  kycId: string,
  countryCode: string
): Promise<string> {
  const program = getProgram();
  const [registryPDA] = getWhitelistRegistryPDA();
  const [entryPDA] = getWhitelistEntryPDA(wallet);
  const backendKeypair = getBackendKeypair();

  const tx = await program.methods
    .addToWhitelist(wallet, kycId, countryCode)
    .accounts({
      whitelistRegistry: registryPDA,
      whitelistEntry: entryPDA,
      authority: backendKeypair.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .signers([backendKeypair])
    .rpc();

  return tx;
}

export async function removeFromWhitelist(
  wallet: PublicKey,
  reason: string
): Promise<string> {
  const program = getProgram();
  const [registryPDA] = getWhitelistRegistryPDA();
  const [entryPDA] = getWhitelistEntryPDA(wallet);
  const backendKeypair = getBackendKeypair();

  const tx = await program.methods
    .removeFromWhitelist(wallet, reason)
    .accounts({
      whitelistRegistry: registryPDA,
      whitelistEntry: entryPDA,
      authority: backendKeypair.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .signers([backendKeypair])
    .rpc();

  return tx;
}

export async function getWhitelistEntry(wallet: PublicKey) {
  const program = getProgram();
  const [entryPDA] = getWhitelistEntryPDA(wallet);
  try {
    return await (program.account as any).whitelistEntry.fetch(entryPDA);
  } catch {
    return null;
  }
}
