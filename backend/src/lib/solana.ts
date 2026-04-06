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
import {
  TOKEN_2022_PROGRAM_ID,
  createMint,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

// Загружаем IDL после `anchor build`
let idl: any;
try {
  idl = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../idl/rwa_token.json"), "utf-8")
  );
} catch {
  console.warn("IDL not found — run `anchor build` first, then `yarn copy-idl`");
}

const PROGRAM_ID = new PublicKey(
  process.env.PROGRAM_ID ?? "GH9TPWVqa4UVNARHFBXadN5uwLMrhtE6obaHC9LFCKFz"
);

// ── PDA seeds ─────────────────────────────────────────────────────────────
export const WHITELIST_REGISTRY_SEED = Buffer.from("whitelist_registry");
export const WHITELIST_ENTRY_SEED = Buffer.from("whitelist_entry");
export const INVOICE_SEED = Buffer.from("invoice");
export const POOL_CONFIG_SEED = Buffer.from("pool_config");
export const INVESTOR_SEED = Buffer.from("investor");

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
  // 1. Try keypair file (recommended for team use)
  const keyfilePath = process.env.BACKEND_KEYPAIR_PATH
    ?? path.join(__dirname, "../../../keys/devnet-authority.json");
  try {
    const raw = JSON.parse(fs.readFileSync(keyfilePath, "utf-8"));
    return Keypair.fromSecretKey(Uint8Array.from(raw));
  } catch {
    // 2. Fallback to base64 env var
    const b64 = process.env.BACKEND_PRIVATE_KEY;
    if (!b64) throw new Error(
      "Backend keypair not found. Either place keys/devnet-authority.json or set BACKEND_PRIVATE_KEY (base64)."
    );
    return Keypair.fromSecretKey(Buffer.from(b64, "base64"));
  }
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
    _program = new Program(idl, provider);
  }
  return _program;
}

function getUsdtMint(): PublicKey {
  const mint = process.env.USDT_MINT;
  if (!mint) throw new Error("USDT_MINT not set");
  return new PublicKey(mint);
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

export function getPoolConfigPDA(riskLevel: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [POOL_CONFIG_SEED, Buffer.from([riskLevel])],
    PROGRAM_ID
  );
}

export function getInvestorPositionPDA(
  invoiceId: string,
  wallet: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [INVESTOR_SEED, Buffer.from(invoiceId), wallet.toBuffer()],
    PROGRAM_ID
  );
}

// ── On-chain операции: Whitelist ──────────────────────────────────────────

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

// ── On-chain операции: Pool ───────────────────────────────────────────────

export async function initializePool(
  riskLevel: number,
  baseRateBps: number,
  markupBps: number
): Promise<string> {
  const program = getProgram();
  const [poolConfigPDA] = getPoolConfigPDA(riskLevel);
  const backendKeypair = getBackendKeypair();

  const tx = await program.methods
    .initializePool(riskLevel, baseRateBps, markupBps)
    .accounts({
      poolConfig: poolConfigPDA,
      authority: backendKeypair.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .signers([backendKeypair])
    .rpc();

  return tx;
}

export async function getPoolConfig(riskLevel: number) {
  const program = getProgram();
  const [poolConfigPDA] = getPoolConfigPDA(riskLevel);
  try {
    return await (program.account as any).poolConfig.fetch(poolConfigPDA);
  } catch {
    return null;
  }
}

// ── On-chain операции: Invoice ────────────────────────────────────────────

export async function createInvoice(
  invoiceId: string,
  totalAmount: number,
  creditor: PublicKey,
  debtor: PublicKey,
  dueDate: number,
  interestRateBps: number,
  riskLevel: number,
  documentHash: Uint8Array
): Promise<{ tx: string; mint: PublicKey }> {
  const program = getProgram();
  const connection = getConnection();
  const backendKeypair = getBackendKeypair();
  const [invoicePDA] = getInvoicePDA(invoiceId);
  const [poolConfigPDA] = getPoolConfigPDA(riskLevel);

  // Create Token-2022 mint with invoice PDA as mint authority
  const invoiceMint = await createMint(
    connection,
    backendKeypair,
    invoicePDA, // mint authority = invoice PDA
    null, // no freeze authority
    6, // INVOICE_TOKEN_DECIMALS
    undefined,
    { commitment: "confirmed" },
    TOKEN_2022_PROGRAM_ID
  );

  const tx = await program.methods
    .createInvoice(
      invoiceId,
      new BN(totalAmount),
      creditor,
      debtor,
      new BN(dueDate),
      interestRateBps,
      riskLevel,
      Array.from(documentHash)
    )
    .accounts({
      invoice: invoicePDA,
      poolConfig: poolConfigPDA,
      invoiceMint: invoiceMint,
      authority: backendKeypair.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .signers([backendKeypair])
    .rpc();

  return { tx, mint: invoiceMint };
}

export async function advanceToCreditor(invoiceId: string): Promise<string> {
  const program = getProgram();
  const backendKeypair = getBackendKeypair();
  const [invoicePDA] = getInvoicePDA(invoiceId);
  const usdtMint = getUsdtMint();

  // Fetch invoice to get creditor
  const invoice = await (program.account as any).invoiceAccount.fetch(invoicePDA);

  // Vault is ATA of invoice PDA for USDT (Token-2022)
  const invoiceVault = getAssociatedTokenAddressSync(
    usdtMint,
    invoicePDA,
    true, // allowOwnerOffCurve (PDA)
    TOKEN_2022_PROGRAM_ID
  );

  // Ensure creditor USDT ATA exists
  const creditorAtaAccount = await getOrCreateAssociatedTokenAccount(
    getConnection(),
    backendKeypair,
    usdtMint,
    invoice.creditor,
    false,
    "confirmed",
    undefined,
    TOKEN_2022_PROGRAM_ID
  );
  const creditorUsdt = creditorAtaAccount.address;

  const tx = await program.methods
    .advanceToCreditor(invoiceId)
    .accounts({
      invoice: invoicePDA,
      usdtMint: usdtMint,
      invoiceVault: invoiceVault,
      creditorUsdt: creditorUsdt,
      authority: backendKeypair.publicKey,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    })
    .signers([backendKeypair])
    .rpc();

  return tx;
}

export async function settleInvoice(invoiceId: string): Promise<string> {
  const program = getProgram();
  const backendKeypair = getBackendKeypair();
  const [invoicePDA] = getInvoicePDA(invoiceId);
  const usdtMint = getUsdtMint();

  const invoiceVault = getAssociatedTokenAddressSync(
    usdtMint,
    invoicePDA,
    true,
    TOKEN_2022_PROGRAM_ID
  );

  // Ensure authority USDT ATA exists
  const authorityAtaAccount = await getOrCreateAssociatedTokenAccount(
    getConnection(),
    backendKeypair,
    usdtMint,
    backendKeypair.publicKey,
    false,
    "confirmed",
    undefined,
    TOKEN_2022_PROGRAM_ID
  );
  const authorityUsdt = authorityAtaAccount.address;

  const tx = await program.methods
    .settleInvoice(invoiceId)
    .accounts({
      invoice: invoicePDA,
      usdtMint: usdtMint,
      invoiceVault: invoiceVault,
      authorityUsdt: authorityUsdt,
      authority: backendKeypair.publicKey,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    })
    .signers([backendKeypair])
    .rpc();

  return tx;
}

export async function markDefault(invoiceId: string): Promise<string> {
  const program = getProgram();
  const backendKeypair = getBackendKeypair();
  const [invoicePDA] = getInvoicePDA(invoiceId);

  const tx = await program.methods
    .markDefault(invoiceId)
    .accounts({
      invoice: invoicePDA,
      authority: backendKeypair.publicKey,
    })
    .signers([backendKeypair])
    .rpc();

  return tx;
}

export async function getInvoice(invoiceId: string) {
  const program = getProgram();
  const [invoicePDA] = getInvoicePDA(invoiceId);
  try {
    return await (program.account as any).invoiceAccount.fetch(invoicePDA);
  } catch {
    return null;
  }
}

export async function getAllInvoices() {
  const program = getProgram();
  return await (program.account as any).invoiceAccount.all();
}
