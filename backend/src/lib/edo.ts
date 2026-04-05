import * as crypto from "crypto";

export interface EdoInvoice {
  id: string;
  creditor: { name: string; bin: string };
  debtor: { name: string; bin: string };
  description: string;
  amountKzt: number;
  usdtEquivalent: number;
  issueDate: string;
  dueDate: string;
  status: "confirmed" | "pending";
}

export const mockEdoInvoices: EdoInvoice[] = [
  {
    id: "EDO-2026-001",
    creditor: { name: 'TOO "TechService KZ"', bin: "180740021345" },
    debtor: { name: 'TOO "Magnum Cash&Carry"', bin: "120140003968" },
    description: "IT-обслуживание серверной инфраструктуры, март 2026",
    amountKzt: 4_900_000,
    usdtEquivalent: 10_000,
    issueDate: "2026-03-15",
    dueDate: "2026-05-15",
    status: "confirmed",
  },
  {
    id: "EDO-2026-002",
    creditor: { name: 'TOO "Astana Logistics"', bin: "150340005612" },
    debtor: { name: 'TOO "Казахмыс"', bin: "970740000282" },
    description: "Транспортировка медной руды, февраль-март 2026",
    amountKzt: 24_500_000,
    usdtEquivalent: 50_000,
    issueDate: "2026-03-01",
    dueDate: "2026-06-01",
    status: "confirmed",
  },
  {
    id: "EDO-2026-003",
    creditor: { name: 'TOO "GreenBuild"', bin: "200140008923" },
    debtor: { name: 'TOO "BI Group"', bin: "980640000134" },
    description: "Поставка строительных материалов, объект Expo City",
    amountKzt: 14_700_000,
    usdtEquivalent: 30_000,
    issueDate: "2026-02-20",
    dueDate: "2026-05-20",
    status: "confirmed",
  },
  {
    id: "EDO-2026-004",
    creditor: { name: 'TOO "MedSupply Almaty"', bin: "190540012478" },
    debtor: { name: 'TOO "Halyk Bank"', bin: "950140000013" },
    description: "Поставка медоборудования для корпоративной клиники",
    amountKzt: 7_350_000,
    usdtEquivalent: 15_000,
    issueDate: "2026-03-10",
    dueDate: "2026-04-25",
    status: "confirmed",
  },
  {
    id: "EDO-2026-005",
    creditor: { name: 'TOO "AgriTech Kostanay"', bin: "170240007891" },
    debtor: { name: 'TOO "Food Master"', bin: "010740000567" },
    description: "Поставка зерна пшеницы, 200 тонн",
    amountKzt: 19_600_000,
    usdtEquivalent: 40_000,
    issueDate: "2026-03-05",
    dueDate: "2026-06-05",
    status: "confirmed",
  },
  {
    id: "EDO-2026-006",
    creditor: { name: 'TOO "Digital Solutions"', bin: "210340015634" },
    debtor: { name: 'TOO "КазМунайГаз"', bin: "020140000970" },
    description: "Разработка ПО для мониторинга нефтепроводов",
    amountKzt: 34_300_000,
    usdtEquivalent: 70_000,
    issueDate: "2026-01-15",
    dueDate: "2026-07-15",
    status: "pending",
  },
  {
    id: "EDO-2026-007",
    creditor: { name: 'TOO "CleanEnergy Aktau"', bin: "160840009012" },
    debtor: { name: 'TOO "KEGOC"', bin: "960640000089" },
    description: "Обслуживание солнечных панелей, Q1 2026",
    amountKzt: 9_800_000,
    usdtEquivalent: 20_000,
    issueDate: "2026-03-20",
    dueDate: "2026-05-20",
    status: "confirmed",
  },
];

export function validateDocument(base64: string): {
  valid: boolean;
  hash: string;
  details: {
    sizeBytes: number;
    format: string;
    verifiedAt: string;
  };
} {
  const buffer = Buffer.from(base64, "base64");
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");

  return {
    valid: true,
    hash,
    details: {
      sizeBytes: buffer.length,
      format: "application/pdf",
      verifiedAt: new Date().toISOString(),
    },
  };
}

export function getDocumentHashBytes(base64: string): Uint8Array {
  const buffer = Buffer.from(base64, "base64");
  return new Uint8Array(crypto.createHash("sha256").update(buffer).digest());
}
