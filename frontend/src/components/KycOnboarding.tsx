import { useState } from "react";

interface Props { wallet: string; onKycComplete?: () => void }

/**
 * Компонент встраивает Sumsub WebSDK iframe.
 * В mock-режиме (бэкенд возвращает { mock: true }) — сразу показывает "KYC Approved".
 */
export default function KycOnboarding({ wallet, onKycComplete }: Props) {
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [mockApproved, setMockApproved] = useState(false);
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
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Mock mode — backend whitelisted directly, no Sumsub iframe needed
      if (data.mock) {
        setMockApproved(true);
        setStarted(true);
        onKycComplete?.();
        return;
      }

      // Real Sumsub flow
      await loadSumsubSdk();

      const snsWebSdkInstance = (window as any).snsWebSdk
        .init(data.token, () => fetchNewToken(wallet))
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
      {mockApproved && (
        <div style={{
          padding: "12px 20px",
          background: "#e8f5e9",
          border: "1px solid #4caf50",
          borderRadius: 8,
          color: "#2e7d32",
          fontWeight: 600,
        }}>
          KYC Approved (Mock Mode) — wallet whitelisted on-chain
        </div>
      )}
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
