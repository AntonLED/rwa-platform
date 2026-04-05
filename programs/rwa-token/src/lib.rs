use anchor_lang::prelude::*;

declare_id!("RWATo11111111111111111111111111111111111111");

pub const WHITELIST_REGISTRY_SEED: &[u8] = b"whitelist_registry";
pub const WHITELIST_ENTRY_SEED: &[u8] = b"whitelist_entry";
pub const INVOICE_SEED: &[u8] = b"invoice";

pub const MAX_KYC_ID_LEN: usize = 64;
pub const MAX_COUNTRY_CODE_LEN: usize = 3;
pub const MAX_REASON_LEN: usize = 128;
pub const MAX_INVOICE_ID_LEN: usize = 32;

#[program]
pub mod rwa_token {
    use super::*;

    pub fn initialize_whitelist_registry(ctx: Context<InitializeWhitelistRegistry>) -> Result<()> {
        let r = &mut ctx.accounts.whitelist_registry;
        r.authority = ctx.accounts.authority.key();
        r.total_whitelisted = 0;
        r.bump = ctx.bumps.whitelist_registry;
        emit!(RegistryInitialized {
            authority: r.authority,
            timestamp: Clock::get()?.unix_timestamp
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
            timestamp: e.whitelisted_at
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
            timestamp: Clock::get()?.unix_timestamp
        });
        Ok(())
    }

    pub fn create_invoice_token(
        ctx: Context<CreateInvoiceToken>,
        invoice_id: String,
        total_amount: u64,
        debtor: Pubkey,
        due_date: i64,
    ) -> Result<()> {
        require!(
            invoice_id.len() <= MAX_INVOICE_ID_LEN,
            RwaError::StringTooLong
        );

        let inv = &mut ctx.accounts.invoice;
        inv.invoice_id = invoice_id.clone();
        inv.total_amount = total_amount;
        inv.debtor = debtor;
        inv.due_date = due_date;
        inv.status = InvoiceStatus::Active;
        inv.authority = ctx.accounts.authority.key();
        inv.bump = ctx.bumps.invoice;

        emit!(InvoiceCreated {
            invoice_id,
            total_amount,
            debtor,
            due_date,
            timestamp: Clock::get()?.unix_timestamp
        });
        Ok(())
    }

    pub fn repay_invoice(ctx: Context<RepayInvoice>, amount: u64) -> Result<()> {
        let inv = &mut ctx.accounts.invoice;
        require!(inv.status == InvoiceStatus::Active, RwaError::InvalidStatus);
        inv.status = InvoiceStatus::Repaid;
        emit!(InvoiceRepaid {
            invoice_id: inv.invoice_id.clone(),
            amount,
            timestamp: Clock::get()?.unix_timestamp
        });
        Ok(())
    }

    pub fn transfer_hook(ctx: Context<TransferHook>, amount: u64) -> Result<()> {
        require!(ctx.accounts.whitelist_entry.is_active, RwaError::NotKyced);
        msg!(
            "Transfer {} approved for {}",
            amount,
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
#[instruction(invoice_id: String)]
pub struct CreateInvoiceToken<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + InvoiceAccount::INIT_SPACE,
        seeds = [INVOICE_SEED, invoice_id.as_bytes()],
        bump
    )]
    pub invoice: Account<'info, InvoiceAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RepayInvoice<'info> {
    #[account(
        mut,
        seeds = [INVOICE_SEED, invoice.invoice_id.as_bytes()],
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
pub struct InvoiceAccount {
    #[max_len(32)]
    pub invoice_id: String,
    pub total_amount: u64,
    pub debtor: Pubkey,
    pub due_date: i64,
    pub status: InvoiceStatus,
    pub authority: Pubkey,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
pub enum InvoiceStatus {
    Active,
    Repaid,
    Defaulted,
}

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
pub struct InvoiceCreated {
    pub invoice_id: String,
    pub total_amount: u64,
    pub debtor: Pubkey,
    pub due_date: i64,
    pub timestamp: i64,
}
#[event]
pub struct InvoiceRepaid {
    pub invoice_id: String,
    pub amount: u64,
    pub timestamp: i64,
}

#[error_code]
pub enum RwaError {
    #[msg("Wallet is not KYC verified")]
    NotKyced,
    #[msg("Invalid invoice status")]
    InvalidStatus,
    #[msg("String value too long")]
    StringTooLong,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Wallet KYC already revoked")]
    AlreadyRevoked,
}
