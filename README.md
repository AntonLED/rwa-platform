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
│  KYC: Sumsub WebSDK + Webhooks                          │
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
| KYC | Sumsub WebSDK + Webhook |

## Бизнес-флоу

```
1. Кредитор загружает инвойс (или импортирует из ЭДО)
   → хэш документа сохраняется on-chain, создаётся Token-2022 mint

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
| **MetadataPointer** | Метаданные инвойса привязаны к on-chain аккаунтам |

## PDA программы

| PDA | Seeds | Назначение |
|---|---|---|
| WhitelistRegistry | `["whitelist_registry"]` | Синглтон — authority + счётчик верифицированных |
| WhitelistEntry | `["whitelist_entry", wallet]` | KYC-запись кошелька (kyc_id, country_code, is_active) |
| PoolConfig | `["pool_config", risk_level]` | Конфиг пула риска (base_rate_bps, markup_bps) |
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
| `POST` | `/api/kyc/token` | Получить SDK-токен для Sumsub WebSDK |
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
| `GET` | `/api/pools` | Получить оба пула |
| `POST` | `/api/pools/initialize` | Инициализировать пул риска |
| `GET` | `/api/edo/invoices` | Список мок-инвойсов ЭДО |
| `POST` | `/api/edo/validate` | Валидация хэша документа |
| `GET` | `/health` | Health check |

## Роли фронтенда

| Роль | Роуты | Функционал |
|---|---|---|
| **Investor** | `/investor` | Маркетплейс инвойсов, финансирование, портфель + claim |
| **Creditor** | `/creditor` | Загрузка инвойсов, импорт из ЭДО, дашборд |
| **Admin** | `/admin` | Статистика, управление инвойсами (advance/settle/default), управление пулами (Senior/Junior), KYC whitelist (просмотр + отзыв) |

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

### 1. Сборка и деплой

```bash
# Настройка Solana — используем shared devnet keypair из репо
solana config set --url devnet
solana config set --keypair keys/devnet-authority.json
solana airdrop 2    # нужен SOL для транзакций

# Сборка программы
anchor build

# Синхронизация IDL (обязательно после каждого anchor build!)
yarn copy-idl

# Деплой (обычно уже задеплоен — этот шаг только при первом деплое)
anchor deploy

# ⚠️ Перед запуском — вставь адрес своего Phantom кошелька (инвестор) в:
#   scripts/init-devnet.ts → INVESTOR_WALLET_ADDRESS
# Скрипт выдаст 100K mock USDT на этот адрес для тестирования fund invoice.
anchor run init-devnet
```

> **Keypair:** Devnet keypair оператора лежит в `keys/devnet-authority.json` и используется бэкендом автоматически. Генерировать свой не нужно.

> **Важно:** `Anchor.toml` → `[provider] cluster` должен быть `Devnet` для деплоя и `Localnet` для тестов. Переключать вручную перед каждой операцией.

### Troubleshooting

<details>
<summary><b>edition2024 is required / feature not stabilized in Cargo X.XX</b></summary>

`anchor build` использует встроенный Cargo из Solana platform-tools, а не системный. Если platform-tools < v1.52, его Cargo слишком старый для зависимостей с `edition = "2024"`.

**Решение:**

```bash
# 1. Обновить Agave (включает platform-tools v1.52+)
agave-install init 3.1.11

# 2. Очистить кэш cargo registry
rm -rf ~/.cargo/registry/src/index.crates.io-*/toml_datetime-1.1.1*

# 3. Пересобрать
anchor build
```

Проверить версию platform-tools: `cargo build-sbf --version` → должна быть v1.52+.
</details>

<details>
<summary><b>anchor build зависает или падает по памяти</b></summary>

Сборка Solana BPF-программ требует ~4GB RAM. На машинах с малым объёмом памяти:

```bash
# Ограничить параллелизм
CARGO_BUILD_JOBS=2 anchor build
```
</details>

<details>
<summary><b>IDL not found / Account not found после билда</b></summary>

IDL не синхронизирован с фронтендом/бэкендом:

```bash
yarn copy-idl   # Копирует target/idl/rwa_token.json → frontend/src/idl/ + backend/src/idl/
```
</details>

<details>
<summary><b>Custom program error при деплое / тестах</b></summary>

Program ID не совпадает. После первого деплоя обновить ID во всех 3 местах:
- `Anchor.toml` → `[programs.devnet]` и `[programs.localnet]`
- `backend/src/lib/solana.ts` → `PROGRAM_ID`
- `frontend/src/hooks/useInvoice.ts` → `PROGRAM_ID`
</details>

После деплоя обновить Program ID в:
- `Anchor.toml` → `[programs.devnet]`
- `backend/src/lib/solana.ts` → `PROGRAM_ID`
- `frontend/src/hooks/useInvoice.ts` → `PROGRAM_ID`

### 2. Тесты

14 Anchor-тестов: полный lifecycle факторинга.

```bash
# Запуск с локальным валидатором (рекомендуется)
anchor test --provider.cluster localnet

# Или если валидатор уже запущен
anchor test --skip-local-validator
```

**Тестовые зависимости** (root `package.json` devDependencies):
- `@coral-xyz/anchor`, `@solana/spl-token`, `@solana/web3.js` — Anchor SDK + Token-2022
- `ts-mocha`, `mocha`, `chai` — тест-раннер + assertions
- `@types/mocha`, `@types/chai`, `@types/bn.js` — TypeScript типы
- `bn.js` — BigNumber для Anchor

**Что покрывают тесты** (`tests/rwa-token.ts`):
1. Инициализация whitelist registry
2. Добавление кошелька в whitelist (KYC)
3. Инициализация пулов (low-risk 5%+1%, high-risk 12%+3%)
4. Создание mock USDT mint (Token-2022)
5. Создание инвойса с Token-2022 mint
6. Создание token accounts (USDT ATAs + invoice token ATA)
7. Минт mock USDT инвестору
8. Fund invoice — инвестор вносит USDT, получает invoice-токены
9. Advance 90% кредитору
10. Settle invoice — authority депозитит principal + interest
11. Claim — инвестор сжигает токены, получает USDT
12. Mark default на отдельном инвойсе
13. Transfer hook отклоняет non-KYC кошелёк
14. Transfer hook пропускает KYC-верифицированный кошелёк

### 3. Бэкенд

```bash
cd backend
cp .env.example .env
# Keypair оператора берётся из keys/devnet-authority.json автоматически
# Sumsub credentials — опционально, без них работает mock KYC
yarn dev             # http://localhost:4000
```

### 4. Фронтенд

```bash
cd frontend
yarn dev             # http://localhost:5173
```

## KYC-флоу

```
Пользователь подключает Phantom
  → Фронтенд: POST /api/kyc/token { walletAddress }
  → Бэкенд создаёт Sumsub applicant (externalUserId = wallet)
  → Sumsub WebSDK запускается в браузере (паспорт + liveness)
  → Sumsub webhook: applicantReviewed { reviewAnswer: GREEN }
  → Бэкенд вызывает addToWhitelist on-chain → PDA whitelist_entry
  → Transfer Hook проверяет whitelist при каждом трансфере
```

## Демо-сценарий

**Подготовка:** вставь адрес своего Phantom кошелька в `scripts/init-devnet.ts` → `INVESTOR_WALLET_ADDRESS`, затем запусти `anchor run init-devnet`. Скрипт выдаст 100K mock USDT на этот адрес.

1. **Подключить кошелёк** — открыть `localhost:5173`, подключить Phantom
2. **KYC** — нажать "Start KYC Verification" (mock режим — одобряется мгновенно)
3. **Роль Creditor** — выбрать роль в хедере, импортировать инвойс из ЭДО или создать вручную
4. **Роль Investor** — просмотреть маркетплейс, профинансировать инвойс USDT
5. **Роль Admin** — авансировать 90% кредитору, затем подтвердить settle после оплаты дебитором
6. **Роль Investor** — перейти в Портфель, получить возврат (principal + interest)

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
| `anchor run init-devnet` | Инициализация devnet (registry + пулы + mock USDT) |
| `yarn copy-idl` | Копирование IDL в frontend и backend |
| `yarn dev:backend` | Запуск бэкенда (localhost:4000) |
| `yarn dev:frontend` | Запуск фронтенда (localhost:5173) |

## Program ID

```
J5zLwZs3qmKv69Xd2eGmvbGf8PuCtKD5bh22dm9iZHre (Devnet)
```
