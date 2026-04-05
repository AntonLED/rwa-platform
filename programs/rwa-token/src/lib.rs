use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    burn, mint_to, transfer_checked, Burn, Mint, MintTo, TokenAccount, TokenInterface,
    TransferChecked,
};

declare_id!("J5zLwZs3qmKv69Xd2eGmvbGf8PuCtKD5bh22dm9iZHre");

// ── Seeds ──────────────────────────────────────────────────────────────────
pub const WHITELIST_REGISTRY_SEED: &[u8] = b"whitelist_registry";
pub const WHITELIST_ENTRY_SEED: &[u8] = b"whitelist_entry";
pub const INVOICE_SEED: &[u8] = b"invoice";
pub const POOL_CONFIG_SEED: &[u8] = b"pool_config";
pub const INVESTOR_SEED: &[u8] = b"investor";
// ── Limits ─────────────────────────────────────────────────────────────────
pub const MAX_KYC_ID_LEN: usize = 64;
pub const MAX_COUNTRY_CODE_LEN: usize = 3;
pub const MAX_REASON_LEN: usize = 128;
pub const MAX_INVOICE_ID_LEN: usize = 32;
pub const ADVANCE_BPS: u64 = 9000; // 90%
pub const BPS_DENOMINATOR: u64 = 10000;
pub const INVOICE_TOKEN_DECIMALS: u8 = 6;

#[program]
pub mod rwa_token {
    use super::*;

    // ── KYC / Whitelist ────────────────────────────────────────────────────

    pub fn initialize_whitelist_registry(ctx: Context<InitializeWhitelistRegistry>) -> Result<()> {
        let r = &mut ctx.accounts.whitelist_registry;
        r.authority = ctx.accounts.authority.key();
        r.total_whitelisted = 0;
        r.bump = ctx.bumps.whitelist_registry;
        emit!(RegistryInitialized {
            authority: r.authority,
            timestamp: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    pub fn add_to_whitelist(
        ctx: Context<ModifyWhitelist>,
        wallet: Pubkey,
        kyc_id: String,
        country_code: String,
    ) -> Result<()> {
        require!(kyc_id.len() <= MAX_KYC_ID_LEN, RwaError::StringTooLong);
        require!(
            country_code.len() <= MAX_COUNTRY_CODE_LEN,
            RwaError::StringTooLong
        );

        let e = &mut ctx.accounts.whitelist_entry;
        e.wallet = wallet;
        e.kyc_id = kyc_id.clone();
        e.country_code = country_code.clone();
        e.whitelisted_at = Clock::get()?.unix_timestamp;
        e.is_active = true;
        e.bump = ctx.bumps.whitelist_entry;

        let r = &mut ctx.accounts.whitelist_registry;
        r.total_whitelisted = r
            .total_whitelisted
            .checked_add(1)
            .ok_or(RwaError::Overflow)?;

        emit!(WalletWhitelisted {
            wallet,
            kyc_id,
            country_code,
            timestamp: e.whitelisted_at,
        });
        Ok(())
    }

    pub fn remove_from_whitelist(
        ctx: Context<ModifyWhitelist>,
        wallet: Pubkey,
        reason: String,
    ) -> Result<()> {
        require!(reason.len() <= MAX_REASON_LEN, RwaError::StringTooLong);

        let e = &mut ctx.accounts.whitelist_entry;
        require!(e.is_active, RwaError::AlreadyRevoked);
        e.is_active = false;

        let r = &mut ctx.accounts.whitelist_registry;
        r.total_whitelisted = r.total_whitelisted.saturating_sub(1);

        emit!(WalletRevoked {
            wallet,
            reason,
            timestamp: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    // ── Pool Management ────────────────────────────────────────────────────

    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        risk_level: u8,
        base_rate_bps: u16,
        markup_bps: u16,
    ) -> Result<()> {
        require!(risk_level <= 1, RwaError::InvalidRiskLevel);
        let pool = &mut ctx.accounts.pool_config;
        pool.risk_level = risk_level;
        pool.base_rate_bps = base_rate_bps;
        pool.markup_bps = markup_bps;
        pool.total_invoices = 0;
        pool.total_funded = 0;
        pool.authority = ctx.accounts.authority.key();
        pool.bump = ctx.bumps.pool_config;

        emit!(PoolInitialized {
            risk_level,
            base_rate_bps,
            markup_bps,
            timestamp: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    // ── Invoice Lifecycle ──────────────────────────────────────────────────

    pub fn create_invoice(
        ctx: Context<CreateInvoice>,
        invoice_id: String,
        total_amount: u64,
        creditor: Pubkey,
        debtor: Pubkey,
        due_date: i64,
        interest_rate_bps: u16,
        risk_level: u8,
        document_hash: [u8; 32],
    ) -> Result<()> {
        require!(
            invoice_id.len() <= MAX_INVOICE_ID_LEN,
            RwaError::StringTooLong
        );
        require!(total_amount > 0, RwaError::InvalidAmount);
        require!(risk_level <= 1, RwaError::InvalidRiskLevel);

        let inv = &mut ctx.accounts.invoice;
        inv.invoice_id = invoice_id.clone();
        inv.total_amount = total_amount;
        inv.creditor = creditor;
        inv.debtor = debtor;
        inv.due_date = due_date;
        inv.interest_rate_bps = interest_rate_bps;
        inv.risk_level = risk_level;
        inv.document_hash = document_hash;
        inv.funded_amount = 0;
        inv.advance_paid = false;
        inv.status = InvoiceStatus::Funding;
        inv.authority = ctx.accounts.authority.key();
        inv.mint = ctx.accounts.invoice_mint.key();
        inv.created_at = Clock::get()?.unix_timestamp;
        inv.bump = ctx.bumps.invoice;

        // Update pool stats
        let pool = &mut ctx.accounts.pool_config;
        pool.total_invoices = pool.total_invoices.checked_add(1).ok_or(RwaError::Overflow)?;

        emit!(InvoiceCreated {
            invoice_id,
            total_amount,
            creditor,
            debtor,
            due_date,
            interest_rate_bps,
            risk_level,
            document_hash,
            timestamp: inv.created_at,
        });
        Ok(())
    }

    /// Investor deposits USDT and receives invoice tokens 1:1
    pub fn fund_invoice(ctx: Context<FundInvoice>, invoice_id: String, amount: u64) -> Result<()> {
        require!(amount > 0, RwaError::InvalidAmount);

        // Read invoice state first (immutable)
        let invoice_status = ctx.accounts.invoice.status.clone();
        let total_amount = ctx.accounts.invoice.total_amount;
        let funded_amount = ctx.accounts.invoice.funded_amount;
        let invoice_bump = ctx.accounts.invoice.bump;
        let invoice_id_stored = ctx.accounts.invoice.invoice_id.clone();

        require!(invoice_status == InvoiceStatus::Funding, RwaError::InvalidStatus);

        let remaining = total_amount
            .checked_sub(funded_amount)
            .ok_or(RwaError::Overflow)?;
        require!(amount <= remaining, RwaError::ExceedsFundingTarget);

        // Transfer USDT from investor to invoice vault
        transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.investor_usdt.to_account_info(),
                    mint: ctx.accounts.usdt_mint.to_account_info(),
                    to: ctx.accounts.invoice_vault.to_account_info(),
                    authority: ctx.accounts.investor.to_account_info(),
                },
            ),
            amount,
            ctx.accounts.usdt_mint.decimals,
        )?;

        // Mint invoice tokens to investor (PDA signs as mint authority)
        let signer_seeds: &[&[&[u8]]] = &[&[INVOICE_SEED, invoice_id_stored.as_bytes(), &[invoice_bump]]];

        mint_to(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.invoice_mint.to_account_info(),
                    to: ctx.accounts.investor_invoice_tokens.to_account_info(),
                    authority: ctx.accounts.invoice.to_account_info(),
                },
            )
            .with_signer(signer_seeds),
            amount,
        )?;

        // Now mutate invoice
        let inv = &mut ctx.accounts.invoice;
        inv.funded_amount = funded_amount
            .checked_add(amount)
            .ok_or(RwaError::Overflow)?;

        if inv.funded_amount >= total_amount {
            inv.status = InvoiceStatus::Funded;
        }

        // Create/update investor position
        let pos = &mut ctx.accounts.investor_position;
        pos.investor = ctx.accounts.investor.key();
        pos.invoice_id = invoice_id_stored;
        pos.amount = pos.amount.checked_add(amount).ok_or(RwaError::Overflow)?;
        pos.funded_at = Clock::get()?.unix_timestamp;
        pos.claimed = false;
        pos.bump = ctx.bumps.investor_position;

        emit!(InvoiceFunded {
            invoice_id,
            investor: ctx.accounts.investor.key(),
            amount,
            total_funded: inv.funded_amount,
            timestamp: pos.funded_at,
        });
        Ok(())
    }

    /// Platform advances 90% of funded USDT to creditor
    pub fn advance_to_creditor(ctx: Context<AdvanceToCreditor>, invoice_id: String) -> Result<()> {
        // Read state first
        let status = ctx.accounts.invoice.status.clone();
        let advance_paid = ctx.accounts.invoice.advance_paid;
        let funded_amount = ctx.accounts.invoice.funded_amount;
        let invoice_bump = ctx.accounts.invoice.bump;
        let invoice_id_stored = ctx.accounts.invoice.invoice_id.clone();
        let creditor = ctx.accounts.invoice.creditor;

        require!(status == InvoiceStatus::Funded, RwaError::InvalidStatus);
        require!(!advance_paid, RwaError::AlreadyAdvanced);

        let advance_amount = funded_amount
            .checked_mul(ADVANCE_BPS)
            .ok_or(RwaError::Overflow)?
            .checked_div(BPS_DENOMINATOR)
            .ok_or(RwaError::Overflow)?;

        // Transfer USDT from vault to creditor (invoice PDA signs)
        let signer_seeds: &[&[&[u8]]] = &[&[INVOICE_SEED, invoice_id_stored.as_bytes(), &[invoice_bump]]];

        transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.invoice_vault.to_account_info(),
                    mint: ctx.accounts.usdt_mint.to_account_info(),
                    to: ctx.accounts.creditor_usdt.to_account_info(),
                    authority: ctx.accounts.invoice.to_account_info(),
                },
            )
            .with_signer(signer_seeds),
            advance_amount,
            ctx.accounts.usdt_mint.decimals,
        )?;

        // Now mutate
        let inv = &mut ctx.accounts.invoice;
        inv.advance_paid = true;
        inv.status = InvoiceStatus::Advanced;

        emit!(AdvancePaid {
            invoice_id,
            creditor,
            amount: advance_amount,
            timestamp: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    /// Backend confirms debtor has paid — deposits USDT into vault
    pub fn settle_invoice(ctx: Context<SettleInvoice>, invoice_id: String) -> Result<()> {
        let inv = &mut ctx.accounts.invoice;
        require!(
            inv.status == InvoiceStatus::Advanced,
            RwaError::InvalidStatus
        );

        // Calculate total repayment: principal + interest
        let days = Clock::get()?
            .unix_timestamp
            .saturating_sub(inv.created_at)
            .max(0) as u64;
        let days_count = days / 86400;
        let rate_bps = inv.interest_rate_bps as u64;
        // interest = principal * rate_bps * days / 365 / 10000
        let interest = inv
            .total_amount
            .checked_mul(rate_bps)
            .ok_or(RwaError::Overflow)?
            .checked_mul(days_count)
            .ok_or(RwaError::Overflow)?
            / 365
            / BPS_DENOMINATOR;

        let repayment = inv
            .total_amount
            .checked_add(interest)
            .ok_or(RwaError::Overflow)?;

        // Transfer USDT from authority to vault (simulates debtor payment)
        transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.authority_usdt.to_account_info(),
                    mint: ctx.accounts.usdt_mint.to_account_info(),
                    to: ctx.accounts.invoice_vault.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
                },
            ),
            repayment,
            ctx.accounts.usdt_mint.decimals,
        )?;

        inv.status = InvoiceStatus::Repaid;

        emit!(InvoiceRepaid {
            invoice_id,
            amount: repayment,
            interest,
            timestamp: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    /// Investor burns tokens and claims USDT proportional share from vault
    pub fn claim(ctx: Context<Claim>, invoice_id: String) -> Result<()> {
        let inv = &ctx.accounts.invoice;
        require!(inv.status == InvoiceStatus::Repaid, RwaError::InvalidStatus);

        let pos = &mut ctx.accounts.investor_position;
        require!(!pos.claimed, RwaError::AlreadyClaimed);

        let investor_tokens = ctx.accounts.investor_invoice_tokens.amount;
        require!(investor_tokens > 0, RwaError::InvalidAmount);

        let total_supply = ctx.accounts.invoice_mint.supply;
        require!(total_supply > 0, RwaError::InvalidAmount);

        // Calculate payout: investor_share * vault_balance
        let vault_balance = ctx.accounts.invoice_vault.amount;
        let payout = (vault_balance as u128)
            .checked_mul(investor_tokens as u128)
            .ok_or(RwaError::Overflow)?
            .checked_div(total_supply as u128)
            .ok_or(RwaError::Overflow)? as u64;

        // Burn investor's invoice tokens
        burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.invoice_mint.to_account_info(),
                    from: ctx.accounts.investor_invoice_tokens.to_account_info(),
                    authority: ctx.accounts.investor.to_account_info(),
                },
            ),
            investor_tokens,
        )?;

        // Transfer USDT from vault to investor (invoice PDA signs)
        let invoice_id_bytes = inv.invoice_id.as_bytes();
        let bump = inv.bump;
        let signer_seeds: &[&[&[u8]]] = &[&[INVOICE_SEED, invoice_id_bytes, &[bump]]];

        transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.invoice_vault.to_account_info(),
                    mint: ctx.accounts.usdt_mint.to_account_info(),
                    to: ctx.accounts.investor_usdt.to_account_info(),
                    authority: ctx.accounts.invoice.to_account_info(),
                },
            )
            .with_signer(signer_seeds),
            payout,
            ctx.accounts.usdt_mint.decimals,
        )?;

        pos.claimed = true;

        emit!(InvestorClaimed {
            invoice_id,
            investor: ctx.accounts.investor.key(),
            tokens_burned: investor_tokens,
            usdt_received: payout,
            timestamp: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    /// Mark invoice as defaulted — tokens remain as proof-of-debt
    pub fn mark_default(ctx: Context<MarkDefault>, invoice_id: String) -> Result<()> {
        let inv = &mut ctx.accounts.invoice;
        require!(
            inv.status == InvoiceStatus::Advanced || inv.status == InvoiceStatus::Funded,
            RwaError::InvalidStatus
        );
        inv.status = InvoiceStatus::Defaulted;

        emit!(InvoiceDefaulted {
            invoice_id,
            timestamp: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    // ── Transfer Hook ──────────────────────────────────────────────────────

    pub fn transfer_hook(ctx: Context<TransferHook>, _amount: u64) -> Result<()> {
        require!(ctx.accounts.whitelist_entry.is_active, RwaError::NotKyced);
        msg!(
            "Transfer approved for {}",
            ctx.accounts.destination_owner.key()
        );
        Ok(())
    }

    pub fn transfer_hook_with_extra_accounts(
        ctx: Context<TransferHook>,
        amount: u64,
    ) -> Result<()> {
        transfer_hook(ctx, amount)
    }
}

// ══════════════════════════════════════════════════════════════════════════
// Account Contexts
// ══════════════════════════════════════════════════════════════════════════

#[derive(Accounts)]
pub struct InitializeWhitelistRegistry<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + WhitelistRegistry::INIT_SPACE,
        seeds = [WHITELIST_REGISTRY_SEED],
        bump
    )]
    pub whitelist_registry: Account<'info, WhitelistRegistry>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(wallet: Pubkey)]
pub struct ModifyWhitelist<'info> {
    #[account(
        mut,
        seeds = [WHITELIST_REGISTRY_SEED],
        bump = whitelist_registry.bump,
        has_one = authority
    )]
    pub whitelist_registry: Account<'info, WhitelistRegistry>,
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + WhitelistEntry::INIT_SPACE,
        seeds = [WHITELIST_ENTRY_SEED, wallet.as_ref()],
        bump
    )]
    pub whitelist_entry: Account<'info, WhitelistEntry>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(risk_level: u8)]
pub struct InitializePool<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + PoolConfig::INIT_SPACE,
        seeds = [POOL_CONFIG_SEED, &[risk_level]],
        bump
    )]
    pub pool_config: Account<'info, PoolConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(invoice_id: String)]
pub struct CreateInvoice<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + InvoiceAccount::INIT_SPACE,
        seeds = [INVOICE_SEED, invoice_id.as_bytes()],
        bump
    )]
    pub invoice: Account<'info, InvoiceAccount>,

    #[account(
        mut,
        seeds = [POOL_CONFIG_SEED, &[pool_config.risk_level]],
        bump = pool_config.bump
    )]
    pub pool_config: Account<'info, PoolConfig>,

    /// Token-2022 mint for this invoice (created externally or via CPI)
    /// Mint authority should be the invoice PDA
    #[account(mut)]
    pub invoice_mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(invoice_id: String)]
pub struct FundInvoice<'info> {
    #[account(
        mut,
        seeds = [INVOICE_SEED, invoice_id.as_bytes()],
        bump = invoice.bump
    )]
    pub invoice: Account<'info, InvoiceAccount>,

    /// CHECK: USDT mint
    pub usdt_mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub investor_usdt: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub invoice_vault: InterfaceAccount<'info, TokenAccount>,

    #[account(mut, address = invoice.mint)]
    pub invoice_mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub investor_invoice_tokens: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = investor,
        space = 8 + InvestorPosition::INIT_SPACE,
        seeds = [INVESTOR_SEED, invoice_id.as_bytes(), investor.key().as_ref()],
        bump
    )]
    pub investor_position: Account<'info, InvestorPosition>,

    #[account(mut)]
    pub investor: Signer<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(invoice_id: String)]
pub struct AdvanceToCreditor<'info> {
    #[account(
        mut,
        seeds = [INVOICE_SEED, invoice_id.as_bytes()],
        bump = invoice.bump,
        has_one = authority
    )]
    pub invoice: Account<'info, InvoiceAccount>,

    pub usdt_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        token::mint = usdt_mint,
        token::authority = invoice
    )]
    pub invoice_vault: InterfaceAccount<'info, TokenAccount>,

    /// Creditor's USDT token account
    #[account(
        mut,
        token::mint = usdt_mint
    )]
    pub creditor_usdt: InterfaceAccount<'info, TokenAccount>,

    pub authority: Signer<'info>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
#[instruction(invoice_id: String)]
pub struct SettleInvoice<'info> {
    #[account(
        mut,
        seeds = [INVOICE_SEED, invoice_id.as_bytes()],
        bump = invoice.bump,
        has_one = authority
    )]
    pub invoice: Account<'info, InvoiceAccount>,

    pub usdt_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        token::mint = usdt_mint,
        token::authority = invoice
    )]
    pub invoice_vault: InterfaceAccount<'info, TokenAccount>,

    /// Authority's USDT account (platform deposits repayment)
    #[account(
        mut,
        token::mint = usdt_mint,
        token::authority = authority
    )]
    pub authority_usdt: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
#[instruction(invoice_id: String)]
pub struct Claim<'info> {
    #[account(
        seeds = [INVOICE_SEED, invoice_id.as_bytes()],
        bump = invoice.bump
    )]
    pub invoice: Account<'info, InvoiceAccount>,

    #[account(mut, address = invoice.mint)]
    pub invoice_mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub investor_invoice_tokens: InterfaceAccount<'info, TokenAccount>,

    pub usdt_mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub invoice_vault: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub investor_usdt: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [INVESTOR_SEED, invoice_id.as_bytes(), investor.key().as_ref()],
        bump = investor_position.bump,
        constraint = investor_position.investor == investor.key()
    )]
    pub investor_position: Account<'info, InvestorPosition>,

    #[account(mut)]
    pub investor: Signer<'info>,

    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
#[instruction(invoice_id: String)]
pub struct MarkDefault<'info> {
    #[account(
        mut,
        seeds = [INVOICE_SEED, invoice_id.as_bytes()],
        bump = invoice.bump,
        has_one = authority
    )]
    pub invoice: Account<'info, InvoiceAccount>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct TransferHook<'info> {
    /// CHECK: source token account
    pub source_token: UncheckedAccount<'info>,
    /// CHECK: mint
    pub mint: UncheckedAccount<'info>,
    /// CHECK: destination token account
    pub destination_token: UncheckedAccount<'info>,
    /// CHECK: destination owner
    pub destination_owner: UncheckedAccount<'info>,
    /// CHECK: extra account meta list
    pub extra_account_meta_list: UncheckedAccount<'info>,
    #[account(
        seeds = [WHITELIST_ENTRY_SEED, destination_owner.key().as_ref()],
        bump = whitelist_entry.bump
    )]
    pub whitelist_entry: Account<'info, WhitelistEntry>,
}

// ══════════════════════════════════════════════════════════════════════════
// Data Accounts
// ══════════════════════════════════════════════════════════════════════════

#[account]
#[derive(InitSpace)]
pub struct WhitelistRegistry {
    pub authority: Pubkey,
    pub total_whitelisted: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct WhitelistEntry {
    pub wallet: Pubkey,
    #[max_len(64)]
    pub kyc_id: String,
    #[max_len(3)]
    pub country_code: String,
    pub whitelisted_at: i64,
    pub is_active: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct PoolConfig {
    pub risk_level: u8,
    pub base_rate_bps: u16,
    pub markup_bps: u16,
    pub total_invoices: u64,
    pub total_funded: u64,
    pub authority: Pubkey,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct InvoiceAccount {
    #[max_len(32)]
    pub invoice_id: String,
    pub total_amount: u64,
    pub funded_amount: u64,
    pub creditor: Pubkey,
    pub debtor: Pubkey,
    pub due_date: i64,
    pub created_at: i64,
    pub interest_rate_bps: u16,
    pub risk_level: u8,
    pub document_hash: [u8; 32],
    pub advance_paid: bool,
    pub status: InvoiceStatus,
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct InvestorPosition {
    pub investor: Pubkey,
    #[max_len(32)]
    pub invoice_id: String,
    pub amount: u64,
    pub funded_at: i64,
    pub claimed: bool,
    pub bump: u8,
}

// ══════════════════════════════════════════════════════════════════════════
// Enums
// ══════════════════════════════════════════════════════════════════════════

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
pub enum InvoiceStatus {
    Funding,
    Funded,
    Advanced,
    Repaid,
    Defaulted,
}

// ══════════════════════════════════════════════════════════════════════════
// Events
// ══════════════════════════════════════════════════════════════════════════

#[event]
pub struct RegistryInitialized {
    pub authority: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct WalletWhitelisted {
    pub wallet: Pubkey,
    pub kyc_id: String,
    pub country_code: String,
    pub timestamp: i64,
}

#[event]
pub struct WalletRevoked {
    pub wallet: Pubkey,
    pub reason: String,
    pub timestamp: i64,
}

#[event]
pub struct PoolInitialized {
    pub risk_level: u8,
    pub base_rate_bps: u16,
    pub markup_bps: u16,
    pub timestamp: i64,
}

#[event]
pub struct InvoiceCreated {
    pub invoice_id: String,
    pub total_amount: u64,
    pub creditor: Pubkey,
    pub debtor: Pubkey,
    pub due_date: i64,
    pub interest_rate_bps: u16,
    pub risk_level: u8,
    pub document_hash: [u8; 32],
    pub timestamp: i64,
}

#[event]
pub struct InvoiceFunded {
    pub invoice_id: String,
    pub investor: Pubkey,
    pub amount: u64,
    pub total_funded: u64,
    pub timestamp: i64,
}

#[event]
pub struct AdvancePaid {
    pub invoice_id: String,
    pub creditor: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct InvoiceRepaid {
    pub invoice_id: String,
    pub amount: u64,
    pub interest: u64,
    pub timestamp: i64,
}

#[event]
pub struct InvestorClaimed {
    pub invoice_id: String,
    pub investor: Pubkey,
    pub tokens_burned: u64,
    pub usdt_received: u64,
    pub timestamp: i64,
}

#[event]
pub struct InvoiceDefaulted {
    pub invoice_id: String,
    pub timestamp: i64,
}

// ══════════════════════════════════════════════════════════════════════════
// Errors
// ══════════════════════════════════════════════════════════════════════════

#[error_code]
pub enum RwaError {
    #[msg("Wallet is not KYC verified")]
    NotKyced,
    #[msg("Invalid invoice status for this operation")]
    InvalidStatus,
    #[msg("String value too long")]
    StringTooLong,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Wallet KYC already revoked")]
    AlreadyRevoked,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Risk level must be 0 (low) or 1 (high)")]
    InvalidRiskLevel,
    #[msg("Funding amount exceeds target")]
    ExceedsFundingTarget,
    #[msg("Advance already paid")]
    AlreadyAdvanced,
    #[msg("Already claimed")]
    AlreadyClaimed,
}
