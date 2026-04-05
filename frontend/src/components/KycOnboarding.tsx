import { useState } from "react";

interface Props { wallet: string }

/**
 * Компонент встраивает Sumsub WebSDK iframe.
 * 1. Запрашивает у бэкенда SDK-токен (POST /api/kyc/token)
 * 2. Динамически загружает Sumsub WebSDK скрипт
 * 3. Запускает верификацию прямо в странице
 *
 * Docs: https://developers.sumsub.com/web-sdk/
 */
export default function KycOnboarding({ wallet }: Props) {
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startKyc() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/kyc/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: wallet }),
      });
      const { token, error: apiError } = await res.json();
      if (apiError) throw new Error(apiError);

      // Динамически загружаем Sumsub WebSDK
      await loadSumsubSdk();

      // Запускаем SDK
      const snsWebSdkInstance = (window as any).snsWebSdk
        .init(token, () => fetchNewToken(wallet))
        .withConf({ lang: "en" })
        .withOptions({ addViewportTag: false, adaptIframeHeight: true })
        .on("idCheck.onStepCompleted", (payload: any) => {
          console.log("Step completed:", payload);
        })
        .on("idCheck.onApplicantStatusChanged", (payload: any) => {
          console.log("Status changed:", payload);
        })
        .build();

      snsWebSdkInstance.launch("#sumsub-container");
      setStarted(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ margin: "16px 0" }}>
      {!started && (
        <button
          onClick={startKyc}
          disabled={loading}
          style={{
            padding: "10px 24px",
            background: "#512da8",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 15,
          }}
        >
          {loading ? "Loading…" : "Start KYC Verification"}
        </button>
      )}
      {error && <p style={{ color: "red" }}>{error}</p>}
      <div id="sumsub-container" style={{ marginTop: 16 }} />
    </div>
  );
}

function loadSumsubSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).snsWebSdk) return resolve();
    const script = document.createElement("script");
    script.src = "https://static.sumsub.com/idensic/static/sns-websdk-builder.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Sumsub SDK"));
    document.head.appendChild(script);
  });
}

async function fetchNewToken(wallet: string): Promise<string> {
  const res = await fetch("/api/kyc/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress: wallet }),
  });
  const { token } = await res.json();
  return token;
}
