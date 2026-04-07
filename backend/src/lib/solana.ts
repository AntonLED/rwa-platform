import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  AnchorProvider,
  Program,
  Wallet,
  BN,
} from "@coral-xyz/anchor";
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  ExtensionType,
  getMintLen,
  createInitializeMetadataPointerInstruction,
  createInitializeMintInstruction,
  createSetAuthorityInstruction,
  AuthorityType,
  TYPE_SIZE,
  LENGTH_SIZE,
} from "@solana/spl-token";
import {
  pack,
  TokenMetadata,
  createInitializeInstruction as createInitializeTokenMetadataInstruction,
} from "@solana/spl-token-metadata";
import * as fs from "fs";
import * as path from "path";
import bs58 from "bs58";

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
  process.env.PROGRAM_ID ?? "J5zLwZs3qmKv69Xd2eGmvbGf8PuCtKD5bh22dm9iZHre"
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

// ── Create Token-2022 mint with embedded metadata ─────────────────────────
/**
 * Create Token-2022 mint with embedded metadata (name, symbol, uri).
 * If `finalMintAuthority` differs from payer, the mint is created with payer
 * as authority (so it can sign metadata init), then authority is transferred.
 * This is needed when finalMintAuthority is a PDA that cannot sign.
 */
export async function createMintWithMetadata(
  connection: Connection,
  payer: Keypair,
  mintAuthority: PublicKey,
  decimals: number,
  name: string,
  symbol: string,
  uri: string = "",
): Promise<Keypair> {
  const mintKeypair = Keypair.generate();
  const mint = mintKeypair.publicKey;
  const needsTransfer = !mintAuthority.equals(payer.publicKey);

  // Metadata init requires mintAuthority to sign, so use payer first
  const initAuthority = payer.publicKey;

  const metadata: TokenMetadata = {
    mint, name, symbol, uri,
    additionalMetadata: [],
    updateAuthority: payer.publicKey,
  };

  const mintLen = getMintLen([ExtensionType.MetadataPointer]);
  const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;
  const lamports = await connection.getMinimumBalanceForRentExemption(mintLen + metadataLen);

  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mint,
      space: mintLen,
      lamports,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializeMetadataPointerInstruction(mint, payer.publicKey, mint, TOKEN_2022_PROGRAM_ID),
    createInitializeMintInstruction(mint, decimals, initAuthority, null, TOKEN_2022_PROGRAM_ID),
    createInitializeTokenMetadataInstruction({
      programId: TOKEN_2022_PROGRAM_ID,
      mint, metadata: mint,
      name, symbol, uri,
      mintAuthority: initAuthority,
      updateAuthority: payer.publicKey,
    }),
  );

  // Transfer mint authority to PDA if needed
  if (needsTransfer) {
    tx.add(
      createSetAuthorityInstruction(
        mint, payer.publicKey, AuthorityType.MintTokens, mintAuthority, [], TOKEN_2022_PROGRAM_ID,
      ),
    );
  }

  await sendAndConfirmTransaction(connection, tx, [payer, mintKeypair], { commitment: "confirmed" });
  return mintKeypair;
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
  documentHash: Uint8Array
): Promise<{ tx: string; mint: PublicKey }> {
  const program = getProgram();
  const connection = getConnection();
  const backendKeypair = getBackendKeypair();
  const [invoicePDA] = getInvoicePDA(invoiceId);

  // Create Token-2022 mint with metadata + invoice PDA as mint authority
  const mintKeypair = await createMintWithMetadata(
    connection,
    backendKeypair,
    invoicePDA, // mint authority = invoice PDA
    6,
    `RWA Invoice ${invoiceId}`,
    `INV-${invoiceId.slice(0, 6).toUpperCase()}`,
    "", // uri — could point to JSON metadata later
  );
  const invoiceMint = mintKeypair.publicKey;

  const tx = await program.methods
    .createInvoice(
      invoiceId,
      new BN(totalAmount),
      creditor,
      debtor,
      new BN(dueDate),
      interestRateBps,
      Array.from(documentHash)
    )
    .accounts({
      invoice: invoicePDA,
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

  // Fetch invoice state to compute correct settlement amounts
  const invoice = await (program.account as any).invoiceAccount.fetch(invoicePDA);
  const createdAt: number = invoice.createdAt.toNumber();
  const fundedAmount: number = invoice.fundedAmount.toNumber();
  const totalSeniorFunded: number = invoice.totalSeniorFunded.toNumber();
  const juniorFunded = fundedAmount - totalSeniorFunded;

  // Fetch pool rates
  const seniorPool = await getPoolConfig(0);
  const juniorPool = await getPoolConfig(1);
  const seniorRateBps = seniorPool?.baseRateBps ?? 500;
  const juniorRateBps = juniorPool?.baseRateBps ?? 1200;

  // Days elapsed (min 1 to match contract claim formula)
  const nowSeconds = Math.floor(Date.now() / 1000);
  const days = Math.max(1, Math.floor((nowSeconds - createdAt) / 86400));

  // Per-tranche interest (integer math matching contract: / 365 / 10000)
  const seniorInterest = Math.floor(totalSeniorFunded * seniorRateBps * days / 365 / 10000);
  const juniorInterest = Math.floor(juniorFunded * juniorRateBps * days / 365 / 10000);
  const seniorExpectedPayout = totalSeniorFunded + seniorInterest;
  const juniorExpectedPayout = juniorFunded + juniorInterest;
  const totalInvestorPayout = seniorExpectedPayout + juniorExpectedPayout;

  // Vault currently holds 10% of funded amount (after 90% advance to creditor)
  const vaultRetained = Math.floor(fundedAmount * (10000 - 9000) / 10000);
  const amountToDeposit = Math.max(0, totalInvestorPayout - vaultRetained);

  const invoiceVault = getAssociatedTokenAddressSync(
    usdtMint, invoicePDA, true, TOKEN_2022_PROGRAM_ID
  );
  const authorityAtaAccount = await getOrCreateAssociatedTokenAccount(
    getConnection(), backendKeypair, usdtMint, backendKeypair.publicKey,
    false, "confirmed", undefined, TOKEN_2022_PROGRAM_ID
  );

  const tx = await program.methods
    .settleInvoice(invoiceId, new BN(amountToDeposit), new BN(seniorExpectedPayout))
    .accounts({
      invoice: invoicePDA,
      usdtMint: usdtMint,
      invoiceVault: invoiceVault,
      authorityUsdt: authorityAtaAccount.address,
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
  const connection = getConnection();

  const discriminator: Buffer = (program.coder.accounts as any).accountDiscriminator("invoiceAccount");
  const rawAccounts = await connection.getProgramAccounts(PROGRAM_ID, {
    filters: [{ memcmp: { offset: 0, bytes: bs58.encode(discriminator) } }],
  });

  const results: { publicKey: PublicKey; account: any }[] = [];
  for (const { pubkey, account } of rawAccounts) {
    try {
      const decoded = program.coder.accounts.decode("invoiceAccount", account.data);
      results.push({ publicKey: pubkey, account: decoded });
    } catch {
      // stale account with old layout — skip
    }
  }
  return results;
}

export async function getAllWhitelistEntries() {
  const program = getProgram();
  const connection = getConnection();

  const discriminator: Buffer = (program.coder.accounts as any).accountDiscriminator("whitelistEntry");
  const rawAccounts = await connection.getProgramAccounts(PROGRAM_ID, {
    filters: [{ memcmp: { offset: 0, bytes: bs58.encode(discriminator) } }],
  });

  const results: any[] = [];
  for (const { pubkey, account } of rawAccounts) {
    try {
      const decoded = program.coder.accounts.decode("whitelistEntry", account.data);
      results.push({
        wallet: decoded.wallet.toBase58(),
        kycId: decoded.kycId,
        countryCode: decoded.countryCode,
        isActive: decoded.isActive,
        whitelistedAt: decoded.whitelistedAt.toNumber(),
        pubkey: pubkey.toBase58(),
      });
    } catch {
      // skip stale
    }
  }
  return results;
}
