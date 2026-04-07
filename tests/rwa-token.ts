import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { RwaToken } from "../target/types/rwa_token";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  createMint,
  createAssociatedTokenAccount,
  getOrCreateAssociatedTokenAccount,
  getAssociatedTokenAddressSync,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { expect } from "chai";
import BN from "bn.js";

// ── Seeds ──────────────────────────────────────────────────────────────────
const WHITELIST_REGISTRY_SEED = Buffer.from("whitelist_registry");
const WHITELIST_ENTRY_SEED = Buffer.from("whitelist_entry");
const INVOICE_SEED = Buffer.from("invoice");
const POOL_CONFIG_SEED = Buffer.from("pool_config");
const INVESTOR_SEED = Buffer.from("investor");

// ── PDA Helpers ────────────────────────────────────────────────────────────
function getWhitelistRegistryPDA(programId: PublicKey) {
  return PublicKey.findProgramAddressSync([WHITELIST_REGISTRY_SEED], programId);
}

function getWhitelistEntryPDA(wallet: PublicKey, programId: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [WHITELIST_ENTRY_SEED, wallet.toBuffer()],
    programId
  );
}

function getPoolConfigPDA(riskLevel: number, programId: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [POOL_CONFIG_SEED, Buffer.from([riskLevel])],
    programId
  );
}

function getInvoicePDA(invoiceId: string, programId: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [INVOICE_SEED, Buffer.from(invoiceId)],
    programId
  );
}

function getInvestorPositionPDA(
  invoiceId: string,
  wallet: PublicKey,
  programId: PublicKey
) {
  return PublicKey.findProgramAddressSync(
    [INVESTOR_SEED, Buffer.from(invoiceId), wallet.toBuffer()],
    programId
  );
}

describe("rwa-token", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.RwaToken as Program<RwaToken>;
  const connection = provider.connection;
  const authority = provider.wallet as anchor.Wallet;

  const investor = Keypair.generate();
  const creditor = Keypair.generate();
  const debtor = Keypair.generate();
  const nonKycWallet = Keypair.generate();

  let usdtMint: PublicKey;
  let invoiceMint: PublicKey;
  let invoiceMint2: PublicKey;
  let investorUsdtAta: PublicKey;
  let creditorUsdtAta: PublicKey;
  let authorityUsdtAta: PublicKey;
  let invoiceVault: PublicKey;
  let investorInvoiceTokensAta: PublicKey;

  const INVOICE_ID = "INV-TEST-001";
  const INVOICE_ID_DEFAULT = "INV-TEST-002";
  const TOTAL_AMOUNT = 1_000_000; // 1 USDT (6 decimals)
  const DECIMALS = 6;
  const DOCUMENT_HASH = Array.from(
    Buffer.from(
      "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
      "hex"
    )
  );

  before(async () => {
    const airdropAmount = 10 * LAMPORTS_PER_SOL;
    await Promise.all([
      connection
        .requestAirdrop(investor.publicKey, airdropAmount)
        .then((sig) => connection.confirmTransaction(sig)),
      connection
        .requestAirdrop(creditor.publicKey, airdropAmount)
        .then((sig) => connection.confirmTransaction(sig)),
    ]);
  });

  it("1. Initializes whitelist registry", async () => {
    const [registryPDA] = getWhitelistRegistryPDA(program.programId);

    await program.methods
      .initializeWhitelistRegistry()
      .accountsPartial({
        whitelistRegistry: registryPDA,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const registry = await program.account.whitelistRegistry.fetch(registryPDA);
    expect(registry.authority.toBase58()).to.equal(
      authority.publicKey.toBase58()
    );
    expect(registry.totalWhitelisted.toNumber()).to.equal(0);
  });

  it("2. Adds investor to whitelist (KYC)", async () => {
    const [registryPDA] = getWhitelistRegistryPDA(program.programId);
    const [entryPDA] = getWhitelistEntryPDA(
      investor.publicKey,
      program.programId
    );

    await program.methods
      .addToWhitelist(investor.publicKey, "TEST-KYC-001", "KZ")
      .accountsPartial({
        whitelistRegistry: registryPDA,
        whitelistEntry: entryPDA,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const entry = await program.account.whitelistEntry.fetch(entryPDA);
    expect(entry.wallet.toBase58()).to.equal(investor.publicKey.toBase58());
    expect(entry.kycId).to.equal("TEST-KYC-001");
    expect(entry.countryCode).to.equal("KZ");
    expect(entry.isActive).to.be.true;

    const registry = await program.account.whitelistRegistry.fetch(registryPDA);
    expect(registry.totalWhitelisted.toNumber()).to.equal(1);
  });

  it("3. Initializes low-risk and high-risk pools", async () => {
    const [lowPoolPDA] = getPoolConfigPDA(0, program.programId);
    const [highPoolPDA] = getPoolConfigPDA(1, program.programId);

    await program.methods
      .initializePool(0, 500, 100)
      .accountsPartial({
        poolConfig: lowPoolPDA,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .initializePool(1, 1200, 300)
      .accountsPartial({
        poolConfig: highPoolPDA,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const lowPool = await program.account.poolConfig.fetch(lowPoolPDA);
    expect(lowPool.riskLevel).to.equal(0);
    expect(lowPool.baseRateBps).to.equal(500);
    expect(lowPool.markupBps).to.equal(100);

    const highPool = await program.account.poolConfig.fetch(highPoolPDA);
    expect(highPool.riskLevel).to.equal(1);
    expect(highPool.baseRateBps).to.equal(1200);
    expect(highPool.markupBps).to.equal(300);
  });

  it("4. Creates mock USDT mint (Token-2022)", async () => {
    usdtMint = await createMint(
      connection,
      (authority as any).payer,
      authority.publicKey,
      null,
      DECIMALS,
      undefined,
      { commitment: "confirmed" },
      TOKEN_2022_PROGRAM_ID
    );
    expect(usdtMint).to.be.instanceOf(PublicKey);
  });

  it("5. Creates invoice with Token-2022 mint", async () => {
    const [invoicePDA] = getInvoicePDA(INVOICE_ID, program.programId);

    invoiceMint = await createMint(
      connection,
      (authority as any).payer,
      invoicePDA, // mint authority = invoice PDA
      null,
      DECIMALS,
      undefined,
      { commitment: "confirmed" },
      TOKEN_2022_PROGRAM_ID
    );

    const dueDate = Math.floor(Date.now() / 1000) + 60 * 86400;

    await program.methods
      .createInvoice(
        INVOICE_ID,
        new BN(TOTAL_AMOUNT),
        creditor.publicKey,
        debtor.publicKey,
        new BN(dueDate),
        600,
        DOCUMENT_HASH
      )
      .accountsPartial({
        invoice: invoicePDA,
        invoiceMint: invoiceMint,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const invoice = await program.account.invoiceAccount.fetch(invoicePDA);
    expect(invoice.invoiceId).to.equal(INVOICE_ID);
    expect(invoice.totalAmount.toNumber()).to.equal(TOTAL_AMOUNT);
    expect(invoice.fundedAmount.toNumber()).to.equal(0);
    expect(invoice.creditor.toBase58()).to.equal(creditor.publicKey.toBase58());
    expect(invoice.mint.toBase58()).to.equal(invoiceMint.toBase58());
    expect(JSON.stringify(invoice.status)).to.contain("funding");
  });

  it("6. Creates token accounts (USDT ATAs + invoice token ATA)", async () => {
    const [invoicePDA] = getInvoicePDA(INVOICE_ID, program.programId);
    const payer = (authority as any).payer;

    investorUsdtAta = await createAssociatedTokenAccount(
      connection,
      payer,
      usdtMint,
      investor.publicKey,
      { commitment: "confirmed" },
      TOKEN_2022_PROGRAM_ID
    );

    creditorUsdtAta = await createAssociatedTokenAccount(
      connection,
      payer,
      usdtMint,
      creditor.publicKey,
      { commitment: "confirmed" },
      TOKEN_2022_PROGRAM_ID
    );

    authorityUsdtAta = await createAssociatedTokenAccount(
      connection,
      payer,
      usdtMint,
      authority.publicKey,
      { commitment: "confirmed" },
      TOKEN_2022_PROGRAM_ID
    );

    const vaultAcc = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      usdtMint,
      invoicePDA,
      true, // allowOwnerOffCurve for PDA
      "confirmed",
      { commitment: "confirmed" },
      TOKEN_2022_PROGRAM_ID
    );
    invoiceVault = vaultAcc.address;

    investorInvoiceTokensAta = await createAssociatedTokenAccount(
      connection,
      payer,
      invoiceMint,
      investor.publicKey,
      { commitment: "confirmed" },
      TOKEN_2022_PROGRAM_ID
    );

    expect(investorUsdtAta).to.be.instanceOf(PublicKey);
    expect(invoiceVault).to.be.instanceOf(PublicKey);
    expect(investorInvoiceTokensAta).to.be.instanceOf(PublicKey);
  });

  it("7. Mints mock USDT to investor", async () => {
    const mintAmount = 5_000_000;

    await mintTo(
      connection,
      (authority as any).payer,
      usdtMint,
      investorUsdtAta,
      authority.publicKey,
      mintAmount,
      [],
      { commitment: "confirmed" },
      TOKEN_2022_PROGRAM_ID
    );

    const account = await getAccount(
      connection,
      investorUsdtAta,
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );
    expect(Number(account.amount)).to.equal(mintAmount);
  });

  it("8. Funds invoice — investor deposits USDT, receives invoice tokens (Senior tranche)", async () => {
    const [invoicePDA] = getInvoicePDA(INVOICE_ID, program.programId);
    const [investorPositionPDA] = getInvestorPositionPDA(
      INVOICE_ID,
      investor.publicKey,
      program.programId
    );
    const [poolConfigPDA] = getPoolConfigPDA(0, program.programId); // Senior tranche

    const txSig = await program.methods
      .fundInvoice(INVOICE_ID, new BN(TOTAL_AMOUNT), 0) // tranche=0 (Senior)
      .accountsPartial({
        invoice: invoicePDA,
        poolConfig: poolConfigPDA,
        usdtMint: usdtMint,
        investorUsdt: investorUsdtAta,
        invoiceVault: invoiceVault,
        invoiceMint: invoiceMint,
        investorInvoiceTokens: investorInvoiceTokensAta,
        investorPosition: investorPositionPDA,
        investor: investor.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([investor])
      .rpc();

    await connection.confirmTransaction(txSig, "confirmed");

    const invoice = await program.account.invoiceAccount.fetch(invoicePDA);
    expect(invoice.fundedAmount.toNumber()).to.equal(TOTAL_AMOUNT);
    expect(JSON.stringify(invoice.status)).to.contain("funded");

    const tokenAccount = await getAccount(
      connection,
      investorInvoiceTokensAta,
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );
    expect(Number(tokenAccount.amount)).to.equal(TOTAL_AMOUNT);

    const vaultAccount = await getAccount(
      connection,
      invoiceVault,
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );
    expect(Number(vaultAccount.amount)).to.equal(TOTAL_AMOUNT);

    const position = await program.account.investorPosition.fetch(
      investorPositionPDA
    );
    expect(position.amount.toNumber()).to.equal(TOTAL_AMOUNT);
    expect(position.claimed).to.be.false;
    expect(position.tranche).to.equal(0); // Senior

    const invoiceAfter = await program.account.invoiceAccount.fetch(invoicePDA);
    expect(invoiceAfter.totalSeniorFunded.toNumber()).to.equal(TOTAL_AMOUNT);
  });

  it("9. Advances 90% to creditor", async () => {
    const [invoicePDA] = getInvoicePDA(INVOICE_ID, program.programId);
    const expectedAdvance = Math.floor((TOTAL_AMOUNT * 9000) / 10000);

    const advanceTx = await program.methods
      .advanceToCreditor(INVOICE_ID)
      .accountsPartial({
        invoice: invoicePDA,
        usdtMint: usdtMint,
        invoiceVault: invoiceVault,
        creditorUsdt: creditorUsdtAta,
        authority: authority.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .rpc();
    await connection.confirmTransaction(advanceTx, "confirmed");

    const invoice = await program.account.invoiceAccount.fetch(invoicePDA);
    expect(JSON.stringify(invoice.status)).to.contain("advanced");
    expect(invoice.advancePaid).to.be.true;

    const creditorAccount = await getAccount(
      connection,
      creditorUsdtAta,
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );
    expect(Number(creditorAccount.amount)).to.equal(expectedAdvance);

    const vaultAccount = await getAccount(
      connection,
      invoiceVault,
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );
    expect(Number(vaultAccount.amount)).to.equal(
      TOTAL_AMOUNT - expectedAdvance
    );
  });

  it("10. Settles invoice — authority deposits per-tranche amounts", async () => {
    const [invoicePDA] = getInvoicePDA(INVOICE_ID, program.programId);

    // Test: 1 USDT funded entirely as Senior (tranche=0), rate=500bps, days=1 (min)
    const SENIOR_RATE_BPS = 500;
    const days = 1;
    const seniorInterest = Math.floor(TOTAL_AMOUNT * SENIOR_RATE_BPS * days / 365 / 10000);
    const seniorExpectedPayout = TOTAL_AMOUNT + seniorInterest;
    const vaultRetained = Math.floor(TOTAL_AMOUNT * 1000 / 10000); // 10%
    const amountToDeposit = seniorExpectedPayout - vaultRetained;

    await mintTo(
      connection,
      (authority as any).payer,
      usdtMint,
      authorityUsdtAta,
      authority.publicKey,
      amountToDeposit * 2, // buffer
      [],
      { commitment: "confirmed" },
      TOKEN_2022_PROGRAM_ID
    );

    const settleTx = await program.methods
      .settleInvoice(INVOICE_ID, new BN(amountToDeposit), new BN(seniorExpectedPayout))
      .accountsPartial({
        invoice: invoicePDA,
        usdtMint: usdtMint,
        invoiceVault: invoiceVault,
        authorityUsdt: authorityUsdtAta,
        authority: authority.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .rpc();
    await connection.confirmTransaction(settleTx, "confirmed");

    const invoice = await program.account.invoiceAccount.fetch(invoicePDA);
    expect(JSON.stringify(invoice.status)).to.contain("repaid");
    expect(invoice.seniorExpectedPayout.toNumber()).to.equal(seniorExpectedPayout);
    expect(invoice.settledAt.toNumber()).to.be.greaterThan(0);
  });

  it("11. Investor claims — burns tokens, receives USDT", async () => {
    const [invoicePDA] = getInvoicePDA(INVOICE_ID, program.programId);
    const [investorPositionPDA] = getInvestorPositionPDA(
      INVOICE_ID,
      investor.publicKey,
      program.programId
    );

    const investorUsdtBefore = await getAccount(
      connection,
      investorUsdtAta,
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );

    const claimTx = await program.methods
      .claim(INVOICE_ID)
      .accountsPartial({
        invoice: invoicePDA,
        invoiceMint: invoiceMint,
        investorInvoiceTokens: investorInvoiceTokensAta,
        usdtMint: usdtMint,
        invoiceVault: invoiceVault,
        investorUsdt: investorUsdtAta,
        investorPosition: investorPositionPDA,
        investor: investor.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([investor])
      .rpc();
    await connection.confirmTransaction(claimTx, "confirmed");

    const position = await program.account.investorPosition.fetch(
      investorPositionPDA
    );
    expect(position.claimed).to.be.true;

    const investorTokens = await getAccount(
      connection,
      investorInvoiceTokensAta,
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );
    expect(Number(investorTokens.amount)).to.equal(0);

    const investorUsdtAfter = await getAccount(
      connection,
      investorUsdtAta,
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );
    expect(Number(investorUsdtAfter.amount)).to.be.greaterThan(
      Number(investorUsdtBefore.amount)
    );

    const vaultAfter = await getAccount(
      connection,
      invoiceVault,
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );
    expect(Number(vaultAfter.amount)).to.equal(0);
  });

  it("12. Marks a separate invoice as defaulted", async () => {
    const [invoicePDA2] = getInvoicePDA(INVOICE_ID_DEFAULT, program.programId);

    invoiceMint2 = await createMint(
      connection,
      (authority as any).payer,
      invoicePDA2,
      null,
      DECIMALS,
      undefined,
      { commitment: "confirmed" },
      TOKEN_2022_PROGRAM_ID
    );

    const dueDate = Math.floor(Date.now() / 1000) + 30 * 86400;

    await program.methods
      .createInvoice(
        INVOICE_ID_DEFAULT,
        new BN(500_000),
        creditor.publicKey,
        debtor.publicKey,
        new BN(dueDate),
        1200,
        DOCUMENT_HASH
      )
      .accountsPartial({
        invoice: invoicePDA2,
        invoiceMint: invoiceMint2,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // Fund fully to reach Funded status (mark_default requires Funded or Advanced)
    const investorUsdtAta2 = getAssociatedTokenAddressSync(
      usdtMint,
      investor.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID
    );
    const vault2Acc = await getOrCreateAssociatedTokenAccount(
      connection,
      (authority as any).payer,
      usdtMint,
      invoicePDA2,
      true,
      "confirmed",
      { commitment: "confirmed" },
      TOKEN_2022_PROGRAM_ID
    );
    const invoiceVault2 = vault2Acc.address;
    const investorInvoiceTokens2 = await createAssociatedTokenAccount(
      connection,
      (authority as any).payer,
      invoiceMint2,
      investor.publicKey,
      { commitment: "confirmed" },
      TOKEN_2022_PROGRAM_ID
    );

    await mintTo(
      connection,
      (authority as any).payer,
      usdtMint,
      investorUsdtAta2,
      authority.publicKey,
      500_000,
      [],
      { commitment: "confirmed" },
      TOKEN_2022_PROGRAM_ID
    );

    const [investorPositionPDA2] = getInvestorPositionPDA(
      INVOICE_ID_DEFAULT,
      investor.publicKey,
      program.programId
    );

    const [poolConfigPDA2] = getPoolConfigPDA(1, program.programId); // Junior tranche

    await program.methods
      .fundInvoice(INVOICE_ID_DEFAULT, new BN(500_000), 1) // tranche=1 (Junior)
      .accountsPartial({
        invoice: invoicePDA2,
        poolConfig: poolConfigPDA2,
        usdtMint: usdtMint,
        investorUsdt: investorUsdtAta2,
        invoiceVault: invoiceVault2,
        invoiceMint: invoiceMint2,
        investorInvoiceTokens: investorInvoiceTokens2,
        investorPosition: investorPositionPDA2,
        investor: investor.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([investor])
      .rpc();

    await program.methods
      .markDefault(INVOICE_ID_DEFAULT)
      .accountsPartial({
        invoice: invoicePDA2,
        authority: authority.publicKey,
      })
      .rpc();

    const invoice = await program.account.invoiceAccount.fetch(invoicePDA2);
    expect(JSON.stringify(invoice.status)).to.contain("defaulted");
  });

  it("13. Transfer hook rejects transfer to non-KYC wallet", async () => {
    const [entryPDA] = getWhitelistEntryPDA(
      nonKycWallet.publicKey,
      program.programId
    );

    try {
      await program.methods
        .transferHook(new BN(100))
        .accountsPartial({
          sourceToken: Keypair.generate().publicKey,
          mint: usdtMint,
          destinationToken: Keypair.generate().publicKey,
          destinationOwner: nonKycWallet.publicKey,
          extraAccountMetaList: Keypair.generate().publicKey,
          whitelistEntry: entryPDA,
        })
        .rpc();
      expect.fail("Should have thrown NotKyced error");
    } catch (err: any) {
      expect(err).to.exist;
    }
  });

  it("14. Transfer hook allows transfer to KYC-verified wallet", async () => {
    const [entryPDA] = getWhitelistEntryPDA(
      investor.publicKey,
      program.programId
    );

    await program.methods
      .transferHook(new BN(100))
      .accountsPartial({
        sourceToken: Keypair.generate().publicKey,
        mint: usdtMint,
        destinationToken: Keypair.generate().publicKey,
        destinationOwner: investor.publicKey,
        extraAccountMetaList: Keypair.generate().publicKey,
        whitelistEntry: entryPDA,
      })
      .rpc();
  });
});
