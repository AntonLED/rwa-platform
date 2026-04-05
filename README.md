# RWA Platform — Solana / Token-2022 / KYC

Монорепозиторий RWA-платформы на Solana с on-chain KYC через Sumsub.

## Стек

| Слой | Технологии |
|---|---|
| Смарт-контракт | Rust + Anchor 0.31, Token-2022, Transfer Hook |
| Бэкенд | Node.js + TypeScript + Express, @coral-xyz/anchor |
| Фронтенд | React 18 + Vite + @solana/wallet-adapter |
| KYC | Sumsub WebSDK + Webhook |

## Быстрый старт

### 1. Требования

```bash
# Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Anchor CLI
cargo install --git https://github.com/coral-xyz/anchor avm --locked
avm install 0.31.0 && avm use 0.31.0

# Node 20+, Yarn
```

### 2. Сборка и деплой программы

```bash
# Devnet кошелёк
solana config set --url devnet
solana-keygen new --outfile ~/.config/solana/id.json
solana airdrop 2

# Сборка
anchor build

# Копирование IDL на фронт и бэк
yarn copy-idl

# Деплой
anchor deploy
```

После деплоя скопируйте Program ID из вывода в:
- `Anchor.toml` → `[programs.devnet]`
- `backend/src/lib/solana.ts` → `PROGRAM_ID`
- `frontend/src/hooks/useInvoice.ts` → `PROGRAM_ID`

### 3. Инициализация реестра KYC

```bash
# Один раз после деплоя
anchor run init-registry
# или вручную через TypeScript скрипт
```

### 4. Бэкенд

```bash
cd backend
cp .env.example .env
# Заполнить переменные Sumsub + BACKEND_PRIVATE_KEY

yarn install
yarn dev   # http://localhost:4000
```

#### Переменные окружения

| Переменная | Описание |
|---|---|
| `SOLANA_RPC_URL` | RPC эндпоинт (devnet / mainnet-beta) |
| `BACKEND_PRIVATE_KEY` | Base64 keypair оператора платформы |
| `SUMSUB_APP_TOKEN` | App Token из Sumsub Dashboard |
| `SUMSUB_SECRET_KEY` | Secret Key из Sumsub Dashboard |
| `SUMSUB_WEBHOOK_SECRET` | Webhook Secret (настраивается в Sumsub) |

#### API endpoints

| Method | Path | Описание |
|---|---|---|
| `POST` | `/api/kyc/token` | Получить SDK-токен для Sumsub WebSDK |
| `GET` | `/api/whitelist/:wallet` | Проверить KYC-статус кошелька |
| `POST` | `/webhook/sumsub` | Sumsub webhook (GREEN → addToWhitelist) |
| `GET` | `/health` | Health check |

### 5. Фронтенд

```bash
cd frontend
yarn install
yarn dev   # http://localhost:5173
```

## KYC Flow

```
1. Пользователь подключает Phantom
2. Фронтенд: POST /api/kyc/token { walletAddress }
3. Бэкенд создаёт Sumsub applicant (externalUserId = walletAddress)
4. Sumsub WebSDK запускается прямо в браузере
5. Пользователь проходит верификацию (паспорт + liveness check)
6. Sumsub отправляет webhook: applicantReviewed { reviewAnswer: "GREEN" }
7. Бэкенд вызывает on-chain addToWhitelist → PDA whitelist_entry
8. Transfer Hook на Token-2022 проверяет whitelist при каждом трансфере
```

## Архитектура смарт-контракта

```
WhitelistRegistry (PDA: ["whitelist_registry"])
  └── authority: Pubkey
  └── total_whitelisted: u64

WhitelistEntry (PDA: ["whitelist_entry", wallet])
  └── wallet: Pubkey
  └── kyc_id: String        ← Sumsub applicantId
  └── country_code: String  ← ISO "KZ", "FR", "DE"…
  └── is_active: bool       ← false при revoke
  └── whitelisted_at: i64

InvoiceAccount (PDA: ["invoice", invoice_id])
  └── invoice_id: String
  └── total_amount: u64    ← USD cents
  └── debtor: Pubkey
  └── due_date: i64
  └── status: Active | Repaid | Defaulted

Transfer Hook:
  • Вызывается Token-2022 при каждом transfer
  • Проверяет whitelist_entry.is_active получателя
  • Revert с NotKyced если не верифицирован
```

## Соответствие AFSA / AIFC

- KYC через лицензированного провайдера (Sumsub) — AIFC AML Rules 6.1.1 ✓
- Revoke при sanctions hit / истечении верификации ✓
- Audit trail событий on-chain (WalletWhitelisted, WalletRevoked) ✓
- Transfer Hook блокирует неверифицированных получателей ✓
- externalUserId = wallet address для traceability ✓
