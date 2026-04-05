import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { RwaToken } from "../target/types/rwa_token";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, createMint } from "@solana/spl-token";

const WHITELIST_REGISTRY_SEED = Buffer.from("whitelist_registry");
const POOL_CONFIG_SEED = Buffer.from("pool_config");

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.RwaToken as Program<RwaToken>;
  const authority = provider.wallet as anchor.Wallet;
  const connection = provider.connection;

  console.log("=== RWA Platform — Devnet Initialization ===\n");
  console.log("Program ID:", program.programId.toBase58());
  console.log("Authority:", authority.publicKey.toBase58());

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

  // 2. Initialize low-risk pool (5% base + 1% markup)
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
    console.log("2. Low-risk pool initialized:", lowPoolPDA.toBase58(), "(5% + 1%)");
  } catch (e: any) {
    if (e.message?.includes("already in use")) {
      console.log("2. Low-risk pool already exists:", lowPoolPDA.toBase58());
    } else {
      throw e;
    }
  }

  // 3. Initialize high-risk pool (12% base + 3% markup)
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
    console.log("3. High-risk pool initialized:", highPoolPDA.toBase58(), "(12% + 3%)");
  } catch (e: any) {
    if (e.message?.includes("already in use")) {
      console.log("3. High-risk pool already exists:", highPoolPDA.toBase58());
    } else {
      throw e;
    }
  }

  // 4. Create mock USDT mint (Token-2022)
  const usdtMint = await createMint(
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

  console.log("\n=== Summary ===");
  console.log("Whitelist Registry:", registryPDA.toBase58());
  console.log("Low-risk Pool PDA:", lowPoolPDA.toBase58());
  console.log("High-risk Pool PDA:", highPoolPDA.toBase58());
  console.log("Mock USDT Mint:", usdtMint.toBase58());
  console.log("\nUpdate USDT_MINT in:");
  console.log("  - frontend/src/hooks/useInvoice.ts");
  console.log("  - backend .env (if applicable)");
}

main().catch(console.error);
