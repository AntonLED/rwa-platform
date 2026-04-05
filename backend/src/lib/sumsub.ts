/**
 * Sumsub API client
 * Docs: https://developers.sumsub.com/api-reference/
 *
 * Все запросы к Sumsub подписываются HMAC-SHA256:
 *   X-App-Token: <SUMSUB_APP_TOKEN>
 *   X-App-Access-Sig: HMAC-SHA256(ts + method + url + body, SUMSUB_SECRET_KEY)
 *   X-App-Access-Ts: <unix_ts>
 */
import crypto from "crypto";

const BASE_URL = process.env.SUMSUB_BASE_URL ?? "https://api.sumsub.com";
const APP_TOKEN = process.env.SUMSUB_APP_TOKEN ?? "";
const SECRET_KEY = process.env.SUMSUB_SECRET_KEY ?? "";

function sign(ts: number, method: string, url: string, body?: string): string {
  const payload = `${ts}${method.toUpperCase()}${url}${body ?? ""}`;
  return crypto
    .createHmac("sha256", SECRET_KEY)
    .update(payload)
    .digest("hex");
}

async function request<T>(
  method: string,
  path: string,
  body?: object
): Promise<T> {
  const ts = Math.floor(Date.now() / 1000);
  const bodyStr = body ? JSON.stringify(body) : undefined;
  const sig = sign(ts, method, path, bodyStr);

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "X-App-Token": APP_TOKEN,
      "X-App-Access-Sig": sig,
      "X-App-Access-Ts": String(ts),
    },
    body: bodyStr,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sumsub API error ${res.status}: ${text}`);
  }
  return res.json() as T;
}

// ── Типы ──────────────────────────────────────────────────────────────────

export interface SumsubApplicant {
  id: string;
  externalUserId: string;
  review?: {
    reviewStatus: "init" | "pending" | "prechecked" | "queued" | "completed" | "onHold";
    reviewResult?: {
      reviewAnswer: "GREEN" | "RED";
      rejectLabels?: string[];
      reviewRejectType?: string;
    };
  };
  info?: {
    country?: string;
    nationality?: string;
  };
}

export interface SumsubAccessToken {
  token: string;
  userId: string;
}

// ── API методы ────────────────────────────────────────────────────────────

/**
 * Создаёт applicant, привязанного к Solana-адресу кошелька.
 * externalUserId = solana wallet address.
 */
export async function createApplicant(
  walletAddress: string,
  levelName = "basic-kyc-level"
): Promise<SumsubApplicant> {
  return request<SumsubApplicant>(
    "POST",
    `/resources/applicants?levelName=${levelName}`,
    { externalUserId: walletAddress }
  );
}

/**
 * Возвращает короткоживущий SDK-токен для встраивания Sumsub WebSDK
 * в React-фронтенд (компонент KycOnboarding).
 */
export async function createAccessToken(
  applicantId: string,
  levelName = "basic-kyc-level",
  ttlInSecs = 600
): Promise<SumsubAccessToken> {
  return request<SumsubAccessToken>(
    "POST",
    `/resources/accessTokens?userId=${applicantId}&levelName=${levelName}&ttlInSecs=${ttlInSecs}`
  );
}

/**
 * Получает текущий статус applicant.
 */
export async function getApplicant(applicantId: string): Promise<SumsubApplicant> {
  return request<SumsubApplicant>("GET", `/resources/applicants/${applicantId}/one`);
}

/**
 * Верифицирует подпись Sumsub Webhook.
 * SHA-256(webhookSecret + rawBody)
 */
export function verifyWebhookSignature(
  rawBody: string,
  receivedSig: string
): boolean {
  const webhookSecret = process.env.SUMSUB_WEBHOOK_SECRET ?? "";
  const expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(receivedSig, "hex")
    );
  } catch {
    return false;
  }
}
