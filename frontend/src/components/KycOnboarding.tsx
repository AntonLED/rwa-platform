import { useState } from "react";

interface Props { wallet: string; onKycComplete?: () => void }

export default function KycOnboarding({ wallet, onKycComplete }: Props) {
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [mockApproved, setMockApproved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startKyc() {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/kyc/token", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: wallet }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.mock) {
        setMockApproved(true); setStarted(true); onKycComplete?.(); return;
      }
      await loadSumsubSdk();
      const snsWebSdkInstance = (window as any).snsWebSdk
        .init(data.token, () => fetchNewToken(wallet))
        .withConf({ lang: "en" })
        .withOptions({ addViewportTag: false, adaptIframeHeight: true })
        .on("idCheck.onStepCompleted", (p: any) => console.log("Step:", p))
        .on("idCheck.onApplicantStatusChanged", (p: any) => console.log("Status:", p))
        .build();
      snsWebSdkInstance.launch("#sumsub-container");
      setStarted(true);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      {mockApproved && (
        <div className="alert alert-success">✓ KYC Approved (Mock Mode) — wallet whitelisted on-chain</div>
      )}
      {!started && (
        <button className="btn btn-primary" onClick={startKyc} disabled={loading}>
          {loading ? "⏳ Loading..." : "🔐 Start KYC Verification"}
        </button>
      )}
      {error && <div className="alert alert-error">⚠ {error}</div>}
      <div id="sumsub-container" />
    </div>
  );
}

function loadSumsubSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).snsWebSdk) return resolve();
    const script = document.createElement("script");
    script.src = "https://static.sumsub.com/idensic/static/sns-websdk-builder.js";
    script.onload = () => resolve(); script.onerror = () => reject(new Error("Failed to load Sumsub SDK"));
    document.head.appendChild(script);
  });
}

async function fetchNewToken(wallet: string): Promise<string> {
  const res = await fetch("/api/kyc/token", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress: wallet }),
  });
  const { token } = await res.json();
  return token;
}
