# RWA Platform — New Frontend

## Что изменилось

### Дизайн-система (`src/index.css`)
- Полный light/dark mode с переключателем 🌙/☀️ в хедере
- CSS-переменные: цвета, радиусы, тени, шрифты, отступы
- Компоненты: `.card`, `.btn`, `.badge`, `.input`, `.tabs`, `.stat-card`, `.progress-wrap`, `.table-wrap`, `.alert`, `.skeleton`, `.empty-state`

### Header
- SVG-логотип бренда
- Role-switcher с эмодзи (Investor 📈 / Supplier 🏭 / Admin ⚙️)
- KYC badge + theme toggle + WalletMultiButton

### Investor Portal (`/investor`)
- Stat-карточки: TVL, APY, Duration, Network
- Marketplace: карточки инвойсов с прогресс-баром, APY-блоком, таймером
- InvoiceDetail: 2-колоночный лейаут, калькулятор дохода, защита от дефолта
- Portfolio: сводка позиций + таблица с Claim Returns

### Supplier Portal (`/creditor`)
- Stat-карточки: статусы инвойсов, TVL, Advance Received
- SubmitInvoice: drag-and-drop upload + калькулятор аванса + пошаговый гайд
- EDO Import: карточки с кнопкой Import →

### Admin Panel (`/admin`)
- Overview: pipeline chart + compliance status
- InvoiceManagement: таблица с кнопками Pay Advance / Mark Repaid / Default
- PoolManagement: инициализация пулов

## Установка

```bash
# Скопируй файлы из этого архива в свой проект
# Убедись что в main.tsx есть: import "./index.css";

npm install
npm run dev
```

## Структура

```
src/
├── index.css                    ← Дизайн-система (НОВЫЙ)
├── App.tsx                      ← Роутинг
├── main.tsx                     ← Entrypoint с import "./index.css"
├── components/
│   ├── KycOnboarding.tsx
│   ├── shared/
│   │   ├── Header.tsx           ← Новый хедер
│   │   ├── StatusBadge.tsx
│   │   ├── RiskBadge.tsx
│   │   └── WalletStatus.tsx
│   ├── investor/
│   │   ├── InvestorDashboard.tsx
│   │   ├── InvoiceMarketplace.tsx
│   │   ├── InvoiceDetail.tsx
│   │   └── Portfolio.tsx
│   ├── creditor/
│   │   ├── CreditorDashboard.tsx
│   │   ├── SubmitInvoice.tsx
│   │   └── EdoImport.tsx
│   └── admin/
│       ├── AdminDashboard.tsx
│       ├── InvoiceManagement.tsx
│       └── PoolManagement.tsx
└── hooks/
    ├── useRole.ts
    ├── useRefresh.ts
    └── useWhitelist.ts
    (useInvoice, usePool, useInvestorPositions — оставь свои оригинальные!)
```

## Важно
Хуки `useInvoice.ts`, `usePool.ts`, `useInvestorPositions.ts` — **не трогал**, 
оставь свои оригинальные файлы. Только UI переписан.
