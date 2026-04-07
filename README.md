# RWA Factoring Platform — Solana / Token-2022

Платформа открытого факторинга для краткосрочной необеспеченной задолженности на Solana. Малый бизнес (Казахстан) продаёт инвойсы, глобальные инвесторы финансируют через USDT, платформа авансирует 90% кредитору, инвесторы получают principal + interest при погашении.

**Регуляторика:** AIFC/AFSA — on-chain KYC через Sumsub, Transfer Hook блокирует неверифицированные кошельки.

## Архитектура

```
┌─────────────────────────────────────────────────────────┐
│  Frontend (React 18 + Vite)                             │
│  Роли: Investor / Creditor / Admin                      │
│  Кошелёк: Phantom через @solana/wallet-adapter           │
├─────────────────────────────────────────────────────────┤
│  Backend (Express + TypeScript)                          │
│  KYC: Sumsub WebSDK + Webhooks (мок-режим без ключей)   │
│  EDO: Мок электронного документооборота (Казахстан)      │
├─────────────────────────────────────────────────────────┤
│  Solana Program (Anchor 0.31, Token-2022)               │
│  Transfer Hook · Whitelist · Pools · Invoices · Claims  │
└─────────────────────────────────────────────────────────┘
```

| Слой | Стек |
|---|---|
| Смарт-контракт | Rust + Anchor 0.31, Token-2022 (TransferHook, MetadataPointer) |
| Бэкенд | Node.js + TypeScript + Express, @coral-xyz/anchor, Sumsub |
| Фронтенд | React 18 + Vite + @solana/wallet-adapter + react-router-dom |
| KYC | Sumsub WebSDK + Webhook (mock-режим для devnet) |

## Бизнес-флоу

```
1. Кредитор загружает инвойс (или импортирует из ЭДО)
   → хэш документа сохраняется on-chain, создаётся Token-2022 mint с метаданными

2. Инвесторы просматривают маркетплейс, выбирают транш (Senior 5% / Junior 12%) и финансируют через USDT
   → получают invoice-токены 1:1 (Token-2022)
   → InvestorPosition PDA фиксирует вклад, транш и ставку

3. Admin авансирует 90% от суммы кредитору
   → invoice PDA подписывает CPI-перевод из vault

4. Дебитор погашает (off-chain) → Admin подтверждает settle
   → authority депозитит principal + interest в vault

5. Инвесторы сжигают invoice-токены → получают выплату по ставке своего транша
   → payout = position.amount + position.amount × tranche_rate × days / 365 / 10000
   → Senior выплачиваются первыми (waterfall при дефолте)
```

## Token-2022 Extensions

| Extension | Использование |
|---|---|
| **TransferHook** | Каждый трансфер токенов проверяет KYC whitelist; revert с `NotKyced` если получатель не верифицирован |
| **MetadataPointer** | Embedded metadata (name, symbol) — токены корректно отображаются в Phantom и других кошельках |

## PDA программы

| PDA | Seeds | Назначение |
|---|---|---|
| WhitelistRegistry | `["whitelist_registry"]` | Синглтон — authority + счётчик верифицированных |
| WhitelistEntry | `["whitelist_entry", wallet]` | KYC-запись кошелька (kyc_id, country_code, is_active) |
| PoolConfig | `["pool_config", risk_level]` | Конфиг пула: Senior (0) = 5%, Junior (1) = 12% |
| InvoiceAccount | `["invoice", invoice_id]` | Состояние инвойса, authority vault, ссылка на mint |
| InvestorPosition | `["investor", invoice_id, wallet]` | Запись инвестора: сумма, транш (Senior/Junior), ставка, статус claim |

## Жизненный цикл инвойса

```
Funding → Funded → Advanced → Repaid → (Investor Claims)
                  ↘ Defaulted (токены остаются как proof-of-debt)
```

## API эндпоинты

| Метод | Путь | Описание |
|---|---|---|
| `POST` | `/api/kyc/token` | KYC: Sumsub SDK-токен или mock-одобрение |
| `GET` | `/api/whitelist` | Список всех KYC-записей (Admin) |
| `GET` | `/api/whitelist/:wallet` | Проверить on-chain KYC-статус |
| `POST` | `/api/whitelist/:wallet/revoke` | Отозвать KYC (Admin) |
| `POST` | `/webhook/sumsub` | Sumsub webhook (GREEN→whitelist, RED→revoke) |
| `POST` | `/api/faucet` | Выдать 10 000 mock USDT на кошелёк (devnet only) |
| `POST` | `/api/invoices` | Создать инвойс (+ on-chain транзакция) |
| `GET` | `/api/invoices` | Список всех инвойсов |
| `GET` | `/api/invoices/:id` | Инвойс по ID |
| `POST` | `/api/invoices/:id/advance` | Авансировать 90% кредитору |
| `POST` | `/api/invoices/:id/settle` | Settle инвойса (дебитор погасил) |
| `POST` | `/api/invoices/:id/default` | Пометить инвойс как дефолтный |
| `GET` | `/api/pools` | Получить оба пула (Senior/Junior) |
| `POST` | `/api/pools/initialize` | Инициализировать пул |
| `GET` | `/api/edo/invoices` | Список мок-инвойсов ЭДО |
| `POST` | `/api/edo/validate` | Валидация хэша документа |
| `GET` | `/health` | Health check |

## Роли фронтенда

| Роль | Роуты | Функционал |
|---|---|---|
| **Investor** | `/investor` | Маркетплейс инвойсов, финансирование (Senior/Junior), портфель + claim |
| **Creditor** | `/creditor` | Загрузка инвойсов, импорт из ЭДО, дашборд |
| **Admin** | `/admin` | Статистика, управление инвойсами (advance/settle/default), управление пулами, KYC whitelist (просмотр + отзыв) |

Лендинг на `/` — общая страница с описанием платформы и кнопками навигации.

## Быстрый старт

### Требования

| Инструмент | Минимальная версия | Проверить |
|---|---|---|
| Rust | 1.85+ | `rustc --version` |
| Solana CLI (Agave) | 3.1.x | `solana --version` |
| Anchor CLI | 0.31.x | `anchor --version` |
| Platform-tools | v1.52+ | `cargo build-sbf --version` |
| Node.js | 20+ | `node --version` |
| Yarn | 1.22+ | `yarn --version` |

**Установка тулчейна:**

```bash
# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup default stable

# Agave (Solana CLI)
agave-install init 3.1.11

# Anchor CLI
cargo install --git https://github.com/coral-xyz/anchor --tag v0.31.0 anchor-cli

# Node.js зависимости
yarn install
```

### 1. Настройка Solana

```bash
# Используем shared devnet keypair из репо — генерировать свой НЕ нужно
solana config set --url devnet
solana config set --keypair keys/devnet-authority.json
solana airdrop 2    # нужен SOL для транзакций
```

> **Keypair:** Devnet keypair оператора лежит в `keys/devnet-authority.json` (адрес `7oCPSDaLwJPAEFmM5H2W9YFENyN8t5z8yNL6NKEXGWAx`). Используется бэкендом и Anchor автоматически.

### 2. Сборка (обязательна при первом запуске)

```bash
anchor build             # генерирует target/types/ — нужно для init-devnet
# yarn copy-idl          # IDL уже в git, нужно только если менял контракт
# anchor deploy          # программа уже на devnet, пропустить если не менял контракт
```

> **Зачем build без deploy?** Скрипт `init-devnet` использует TypeScript типы из `target/types/rwa_token.ts`, которые генерируются при сборке. Без `anchor build` скрипт не запустится.

### 3. Инициализация devnet

```bash
# Опционально: открой scripts/init-devnet.ts и вставь
# адрес своего Phantom кошелька в INVESTOR_WALLET_ADDRESS
# чтобы получить 100K mock USDT. Можно пропустить — USDT выдаётся через UI.

anchor run init-devnet
```

Скрипт выполняет:
1. Создаёт `backend/.env` из `.env.example` (если нет)
2. Инициализация WhitelistRegistry (если нет)
3. Инициализация пулов Senior (5%) и Junior (12%)
4. Создание mock USDT mint с метаданными (Token-2022)
5. Airdrop 100K USDT инвестору (если `INVESTOR_WALLET_ADDRESS` задан)
6. Mint 1M USDT authority (для settle операций)
7. Автопатч `USDT_MINT` в `backend/.env` и `frontend/.env`

Состояние сохраняется в `.devnet-state.json` — при повторных запусках переиспользует существующий mint.

### 4. Запуск

```bash
# Терминал 1: бэкенд
cd backend
yarn dev               # http://localhost:4000

# Терминал 2: фронтенд
cd frontend
yarn dev               # http://localhost:5173
```

> **Mock KYC:** Sumsub credentials в `.env.example` — плейсхолдеры. Без них KYC работает в mock-режиме: одобряется мгновенно, кошелёк добавляется в whitelist on-chain автоматически.

### 5. Тесты

14 Anchor-тестов: полный lifecycle факторинга.

```bash
# ⚠️ Переключить cluster в Anchor.toml на Localnet перед тестами!
anchor test --provider.cluster localnet

# Или если валидатор уже запущен
anchor test --skip-local-validator
```

### Troubleshooting

<details>
<summary><b>edition2024 is required / feature not stabilized</b></summary>

`anchor build` использует встроенный Cargo из Solana platform-tools. Если platform-tools < v1.52 — Cargo слишком старый.

```bash
agave-install init 3.1.11
rm -rf ~/.cargo/registry/src/index.crates.io-*/toml_datetime-1.1.1*
anchor build
```
</details>

<details>
<summary><b>anchor build зависает или падает по памяти</b></summary>

```bash
CARGO_BUILD_JOBS=2 anchor build
```
</details>

<details>
<summary><b>IDL not found / Account not found</b></summary>

```bash
yarn copy-idl   # Копирует target/idl/rwa_token.json → frontend/src/idl/ + backend/src/idl/
```
</details>

<details>
<summary><b>Program ID mismatch / Custom program error</b></summary>

После `anchor deploy` обновить Program ID в **4 местах**:
- `Anchor.toml` → `[programs.devnet]` и `[programs.localnet]`
- `backend/src/lib/solana.ts` → `PROGRAM_ID`
- `frontend/src/hooks/useInvoice.ts` → `PROGRAM_ID`
- `frontend/src/hooks/useInvestorPositions.ts` → `PROGRAM_ID`
</details>

<details>
<summary><b>USDT_MINT mismatch после init-devnet</b></summary>

`anchor run init-devnet` автоматически патчит USDT_MINT в backend/.env и frontend. Если что-то пошло не так — удали `usdtMint` из `.devnet-state.json` и перезапусти скрипт.
</details>

## KYC-флоу

**Реальный (Sumsub):**
```
Phantom → POST /api/kyc/token → Sumsub applicant → WebSDK (паспорт + liveness)
→ Sumsub webhook (GREEN) → addToWhitelist on-chain → Transfer Hook enforcement
```

**Mock (devnet без Sumsub ключей):**
```
Phantom → POST /api/kyc/token → backend детектит placeholder credentials
→ addToWhitelist on-chain напрямую → "KYC Approved (Mock Mode)"
```

## Демо-сценарий

**Подготовка:** запусти `anchor run init-devnet`. Для получения USDT используй кнопку "Get USDT" в хедере (10K за клик), или задай `INVESTOR_WALLET_ADDRESS` в `scripts/init-devnet.ts` и перезапусти скрипт (100K).

1. **Открыть лендинг** — `localhost:5173`, подключить Phantom кошелёк
2. **KYC** — нажать "KYC Required" в хедере (mock режим — одобряется мгновенно)
3. **Роль Creditor** — переключить роль в хедере, импортировать инвойс из ЭДО или создать вручную
4. **Роль Investor** — просмотреть маркетплейс, выбрать транш (Senior/Junior), профинансировать инвойс
5. **Роль Admin** — авансировать 90% кредитору, затем подтвердить settle
6. **Роль Investor** — перейти в Портфель, нажать "Claim Returns" (principal + interest)

> **Фаусет:** Кнопка "Get USDT" в хедере выдаёт 10K mock USDT. Для больших сумм — `anchor run init-devnet`.

## Соответствие AIFC/AFSA

- KYC через лицензированного провайдера (Sumsub) — AIFC AML Rules 6.1.1
- Отзыв верификации при sanctions/истечении
- On-chain audit trail (события WalletWhitelisted, WalletRevoked)
- Transfer Hook блокирует неверифицированных получателей
- externalUserId = wallet address для traceability

## Скрипты

| Команда | Описание |
|---|---|
| `anchor build` | Сборка программы |
| `anchor test --provider.cluster localnet` | Запуск тестов (localnet) |
| `anchor deploy` | Деплой на devnet |
| `anchor run init-devnet` | Инициализация devnet (registry + пулы + mock USDT + faucet) |
| `yarn copy-idl` | Копирование IDL в frontend и backend |
| `yarn dev:backend` | Запуск бэкенда (localhost:4000) |
| `yarn dev:frontend` | Запуск фронтенда (localhost:5173) |

## Program ID

```
J5zLwZs3qmKv69Xd2eGmvbGf8PuCtKD5bh22dm9iZHre (Devnet)
```
