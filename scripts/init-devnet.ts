import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { RwaToken } from "../target/types/rwa_token";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { 
  TOKEN_2022_PROGRAM_ID, 
  createMint, 
  getMint, 
  getOrCreateAssociatedTokenAccount, 
  mintTo                             
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

const WHITELIST_REGISTRY_SEED = Buffer.from("whitelist_registry");
const POOL_CONFIG_SEED = Buffer.from("pool_config");
const STATE_FILE = path.resolve(__dirname, "../.devnet-state.json");

// === НАСТРОЙКА ИНВЕСТОРА ===
// Вставь сюда адрес кошелька, которому нужно выдать токены
const INVESTOR_WALLET_ADDRESS = "3sPuB3q1Nii6M9rmcfafTVt7fLRg98Mr4ibRCKsuh3CR"; 
const MINT_AMOUNT = 100_000; // Сколько USDT выдать

interface DevnetState {
  usdtMint?: string;
  registryPDA?: string;
  lowPoolPDA?: string;
  highPoolPDA?: string;
}

function loadState(): DevnetState {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveState(state: DevnetState) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n");
  console.log(`\nState saved to ${STATE_FILE}`);
}

function patchFile(filePath: string, pattern: RegExp, replacement: string, label: string) {
  const abs = path.resolve(__dirname, "..", filePath);
  if (!fs.existsSync(abs)) {
    console.log(`  ⚠ ${label}: file not found (${filePath})`);
    return;
  }
  const content = fs.readFileSync(abs, "utf8");
  if (pattern.test(content)) {
    fs.writeFileSync(abs, content.replace(pattern, replacement));
    console.log(`  ✓ ${label} updated`);
  } else {
    console.log(`  – ${label} already up to date`);
  }
}

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.RwaToken as Program<RwaToken>;
  const authority = provider.wallet as anchor.Wallet;
  const connection = provider.connection;

  console.log("=== RWA Platform — Devnet Initialization ===\n");
  console.log("Program ID:", program.programId.toBase58());
  console.log("Authority:", authority.publicKey.toBase58());

  const state = loadState();

  // 1. Initialize whitelist registry
  const [registryPDA] = PublicKey.findProgramAddressSync(
    [WHITELIST_REGISTRY_SEED],
    program.programId
  );

  try {
    await program.methods
      .initializeWhitelistRegistry()
      .accountsPartial({
        whitelistRegistry: registryPDA,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log("\n1. Whitelist Registry initialized:", registryPDA.toBase58());
  } catch (e: any) {
    if (e.message?.includes("already in use")) {
      console.log("\n1. Whitelist Registry already exists:", registryPDA.toBase58());
    } else {
      throw e;
    }
  }

  // 2. Initialize low-risk pool
  const [lowPoolPDA] = PublicKey.findProgramAddressSync(
    [POOL_CONFIG_SEED, Buffer.from([0])],
    program.programId
  );

  try {
    await program.methods
      .initializePool(0, 500, 100)
      .accountsPartial({
        poolConfig: lowPoolPDA,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log("2. Low-risk pool initialized:", lowPoolPDA.toBase58());
  } catch (e: any) {
    console.log("2. Low-risk pool already exists or error.");
  }

  // 3. Initialize high-risk pool
  const [highPoolPDA] = PublicKey.findProgramAddressSync(
    [POOL_CONFIG_SEED, Buffer.from([1])],
    program.programId
  );

  try {
    await program.methods
      .initializePool(1, 1200, 300)
      .accountsPartial({
        poolConfig: highPoolPDA,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log("3. High-risk pool initialized:", highPoolPDA.toBase58());
  } catch (e: any) {
    console.log("3. High-risk pool already exists or error.");
  }

  // 4. USDT mint
  let usdtMint: PublicKey;

  if (state.usdtMint) {
    const existing = new PublicKey(state.usdtMint);
    try {
      await getMint(connection, existing, "confirmed", TOKEN_2022_PROGRAM_ID);
      usdtMint = existing;
      console.log("4. Mock USDT mint reused:", usdtMint.toBase58());
    } catch {
      console.log("4. Previous mint not found, creating new...");
      usdtMint = await createMint(
        connection,
        (authority as any).payer,
        authority.publicKey,
        null,
        6,
        undefined,
        { commitment: "confirmed" },
        TOKEN_2022_PROGRAM_ID
      );
    }
  } else {
    usdtMint = await createMint(
      connection,
      (authority as any).payer,
      authority.publicKey,
      null,
      6,
      undefined,
      { commitment: "confirmed" },
      TOKEN_2022_PROGRAM_ID
    );
    console.log("4. Mock USDT mint created:", usdtMint.toBase58());
  }

  // === ШАГ 6: ВЫДАЧА ТОКЕНОВ ИНВЕСТОРУ (FAUCET) ===
  console.log("\n6. Running Faucet for Investor...");
  
  const investorPubkey = new PublicKey(INVESTOR_WALLET_ADDRESS);

  try {
    // 6.1 Создаем или получаем ATA (сейф) для инвестора. 
    // Это лечит ошибку 3012
    const investorAta = await getOrCreateAssociatedTokenAccount(
      connection,
      (authority as any).payer,
      usdtMint,
      investorPubkey,
      false,
      "confirmed",
      undefined,
      TOKEN_2022_PROGRAM_ID // Используем Token-2022 как и в пункте 4
    );

    console.log(`   Investor ATA: ${investorAta.address.toBase58()}`);

    // 6.2 Начисляем 100,000 USDT (с учетом 6 знаков после запятой)
    const amount = BigInt(MINT_AMOUNT) * BigInt(1_000_000);

    await mintTo(
      connection,
      (authority as any).payer,
      usdtMint,
      investorAta.address,
      authority.publicKey,
      amount,
      [],
      { commitment: "confirmed" },
      TOKEN_2022_PROGRAM_ID
    );

    console.log(`   ✓ Successfully minted ${MINT_AMOUNT} USDT to ${investorPubkey.toBase58()}`);
  } catch (e) {
    console.error("   ✘ Faucet error:", e);
  }

  // 7. Mint USDT to authority (backend keypair) for settle operations
  console.log("\n7. Minting USDT to authority (for settle)...");
  try {
    const authorityAta = await getOrCreateAssociatedTokenAccount(
      connection,
      (authority as any).payer,
      usdtMint,
      authority.publicKey,
      false,
      "confirmed",
      undefined,
      TOKEN_2022_PROGRAM_ID
    );
    const authorityAmount = BigInt(1_000_000) * BigInt(1_000_000); // 1M USDT
    await mintTo(
      connection,
      (authority as any).payer,
      usdtMint,
      authorityAta.address,
      authority.publicKey,
      authorityAmount,
      [],
      { commitment: "confirmed" },
      TOKEN_2022_PROGRAM_ID
    );
    console.log(`   ✓ Minted 1,000,000 USDT to authority ${authority.publicKey.toBase58()}`);
  } catch (e) {
    console.error("   ✘ Authority faucet error:", e);
  }

  // Save state
  saveState({
    usdtMint: usdtMint.toBase58(),
    registryPDA: registryPDA.toBase58(),
    lowPoolPDA: lowPoolPDA.toBase58(),
    highPoolPDA: highPoolPDA.toBase58(),
  });

  // 5. Auto-patch
  const mintStr = usdtMint.toBase58();
  patchFile(
    "frontend/src/hooks/useInvoice.ts",
    /export const USDT_MINT = new PublicKey\("[^"]+"\)/,
    `export const USDT_MINT = new PublicKey("${mintStr}")`,
    "frontend/src/hooks/useInvoice.ts"
  );

  patchFile(
    "backend/.env",
    /^USDT_MINT=.+$/m,
    `USDT_MINT=${mintStr}`,
    "backend/.env"
  );

  console.log("\n=== Final Summary ===");
  console.log("Mock USDT Mint:", usdtMint.toBase58());
  console.log("Investor Wallet:", INVESTOR_WALLET_ADDRESS);
}

main().catch(console.error);
