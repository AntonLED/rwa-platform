# RWA Platform — Frontend

React 18 + Vite + React Router SPA for the open factoring platform on Solana. Three role-based portals (Investor / Supplier / Admin) selected via dropdown in the header (persisted in `localStorage`).

## Stack

- React 18, React Router 6, Vite 5, TypeScript 5
- `@solana/wallet-adapter-react` + `@solana/wallet-adapter-react-ui` (Phantom, Solflare)
- `@coral-xyz/anchor` 0.30.1 (pinned — root/backend use 0.31)
- `@solana/web3.js`, `@solana/spl-token` (Token-2022)

Connection: hardcoded `clusterApiUrl("devnet")` in `main.tsx`. `/api` proxied to `http://localhost:4000` via Vite dev proxy.

## Env

- `VITE_USDT_MINT` — devnet USDT mint, auto-patched by `anchor run init-devnet`. Required (throws on import otherwise).

## Routes

- `/` — `Landing`
- `/investor` — Marketplace, Portfolio (tabs)
- `/investor/invoice/:id` — `InvoiceDetail` (fund flow)
- `/creditor` — SubmitInvoice, EDO Import, own invoices
- `/admin` — Overview, InvoiceManagement, PoolManagement, WhitelistManagement

## Source layout

```
src/
├── main.tsx                  ConnectionProvider + WalletProvider, imports index.css
├── App.tsx                   Router, Header + role routes
├── index.css                 Design system: light/dark vars, .card .btn .badge .input .tabs .stat-card .progress-wrap .table-wrap .alert .skeleton .empty-state
├── idl/rwa_token.json        Anchor IDL (synced via `yarn copy-idl`)
├── components/
│   ├── Landing.tsx
│   ├── KycOnboarding.tsx     Sumsub WebSDK gate
│   ├── shared/               Header (role switcher, theme toggle, KYC badge, WalletMultiButton), StatusBadge, RiskBadge, WalletStatus
│   ├── investor/             InvestorDashboard, InvoiceMarketplace, InvoiceDetail, Portfolio
│   ├── creditor/             CreditorDashboard, SubmitInvoice, EdoImport
│   └── admin/                AdminDashboard, InvoiceManagement, PoolManagement, WhitelistManagement
└── hooks/
    ├── useInvoice.ts         Anchor program client; on-chain fundInvoice + claimReturns; backend-proxied advance/settle/default; invoice/whitelist fetch
    ├── useInvestorPositions.ts  Reads InvestorPosition PDAs for connected wallet
    ├── usePool.ts            Pool config fetch/init
    ├── useWhitelist.ts       KYC entries (admin) + per-wallet status
    ├── useRole.ts            Role state in localStorage
    └── useRefresh.ts         Global event bus (emitRefresh / useRefreshListener) to refetch after on-chain actions
```

## On-chain calls

- User-signed via wallet adapter: `fund_invoice`, `claim` (Token-2022, `skipPreflight: true` to dodge devnet "Blockhash not found").
- Backend-proxied (platform keypair): `POST /api/invoices/:id/{advance,settle,default}`.
- All ATA derivations pass `TOKEN_2022_PROGRAM_ID`. Missing ATAs are created in `preInstructions`.
- PDA seeds: `["invoice", id]`, `["investor", id, wallet]`, `["pool_config", trancheByte]`. Program ID hardcoded in `useInvoice.ts` and `useInvestorPositions.ts` — keep in sync with `Anchor.toml` and backend after redeploy.
