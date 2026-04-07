import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useNavigate } from "react-router-dom";

export default function Landing() {
  const { publicKey } = useWallet();
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: "100dvh", background: "#0b0e11", color: "#fff", overflow: "hidden", position: "relative" }}>
      {/* BACKGROUND BLOBS */}
      <div style={{
        position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0,
      }}>
        <div style={{
          position: "absolute", width: "800px", height: "800px",
          top: "-200px", left: "50%", transform: "translateX(-50%)",
          background: "radial-gradient(ellipse at center, rgba(16,185,129,0.18) 0%, rgba(6,95,70,0.08) 40%, transparent 70%)",
          borderRadius: "50%", filter: "blur(40px)",
        }} />
        <div style={{
          position: "absolute", width: "600px", height: "600px",
          bottom: "-100px", left: "-100px",
          background: "radial-gradient(ellipse at center, rgba(16,185,129,0.12) 0%, rgba(6,78,59,0.06) 40%, transparent 70%)",
          borderRadius: "50%", filter: "blur(60px)",
        }} />
        <div style={{
          position: "absolute", width: "500px", height: "500px",
          top: "30%", right: "-150px",
          background: "radial-gradient(ellipse at center, rgba(20,184,166,0.10) 0%, transparent 60%)",
          borderRadius: "50%", filter: "blur(50px)",
        }} />
      </div>

      {/* NAVBAR */}
      <nav style={{
        position: "relative", zIndex: 10,
        maxWidth: 1200, margin: "0 auto", padding: "20px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <rect width="36" height="36" rx="10" fill="rgba(16,185,129,0.15)" />
            <path d="M9 26V10h9a5 5 0 0 1 0 10h-3l5 6" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="26" cy="13" r="2.5" fill="#10b981" opacity="0.6"/>
          </svg>
          <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" }}>
            RWA <span style={{ color: "#10b981" }}>Platform</span>
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <a href="#features" style={{ color: "#94a3b8", fontSize: 15, fontWeight: 500, textDecoration: "none", transition: "color 0.2s" }}
            onMouseOver={e => (e.currentTarget.style.color = "#fff")}
            onMouseOut={e => (e.currentTarget.style.color = "#94a3b8")}
          >Features</a>
          <a href="#how-it-works" style={{ color: "#94a3b8", fontSize: 15, fontWeight: 500, textDecoration: "none", transition: "color 0.2s" }}
            onMouseOver={e => (e.currentTarget.style.color = "#fff")}
            onMouseOut={e => (e.currentTarget.style.color = "#94a3b8")}
          >How It Works</a>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer" style={{ color: "#94a3b8", fontSize: 15, fontWeight: 500, textDecoration: "none", transition: "color 0.2s" }}
            onMouseOver={e => (e.currentTarget.style.color = "#fff")}
            onMouseOut={e => (e.currentTarget.style.color = "#94a3b8")}
          >Docs</a>

          <div style={{ "--wallet-button-background": "#10b981", "--wallet-button-color": "#0b0e11" } as any}>
            <WalletMultiButton style={{
              background: "#10b981", color: "#0b0e11",
              borderRadius: 12, fontSize: 14, fontWeight: 700,
              height: 40, padding: "0 20px", border: "none",
              fontFamily: "var(--font-body)",
            }} />
          </div>
        </div>
      </nav>

      {/* HERO */}
      <main style={{
        position: "relative", zIndex: 5,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        textAlign: "center", minHeight: "calc(100dvh - 200px)",
        padding: "0 32px",
      }}>
        {/* ICON */}
        <div style={{
          width: 72, height: 72, borderRadius: 20,
          background: "linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(6,95,70,0.1) 100%)",
          border: "1px solid rgba(16,185,129,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 32,
        }}>
          <svg width="40" height="40" viewBox="0 0 36 36" fill="none">
            <path d="M9 26V10h9a5 5 0 0 1 0 10h-3l5 6" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="26" cy="13" r="2.5" fill="#10b981" opacity="0.6"/>
          </svg>
        </div>

        {/* HEADLINE */}
        <h1 style={{
          fontSize: "clamp(2.5rem, 5vw + 1rem, 4.5rem)",
          fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.03em",
          maxWidth: 800, marginBottom: 24,
        }}>
          Real-World Assets{" "}
          <br />
          <span style={{
            background: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>On-Chain</span>
        </h1>

        {/* SUBTITLE */}
        <p style={{
          fontSize: "clamp(1rem, 1.5vw + 0.5rem, 1.25rem)",
          color: "#94a3b8", lineHeight: 1.7, maxWidth: 600, marginBottom: 40,
        }}>
          Tokenize invoices, fund real businesses, earn real yield.
          <br />
          Open factoring on Solana with on-chain KYC and
          institutional-grade tranching.
        </p>

        {/* CTA BUTTONS */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
          <button
            onClick={() => navigate("/investor")}
            style={{
              background: "#10b981", color: "#0b0e11",
              padding: "14px 32px", borderRadius: 14, border: "none",
              fontSize: 16, fontWeight: 700, cursor: "pointer",
              transition: "all 0.2s", fontFamily: "var(--font-body)",
            }}
            onMouseOver={e => { e.currentTarget.style.background = "#34d399"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseOut={e => { e.currentTarget.style.background = "#10b981"; e.currentTarget.style.transform = "translateY(0)"; }}
          >
            Start Investing
          </button>
          <button
            onClick={() => navigate("/creditor")}
            style={{
              background: "transparent", color: "#e2e8f0",
              padding: "14px 32px", borderRadius: 14,
              border: "1.5px solid rgba(148,163,184,0.25)",
              fontSize: 16, fontWeight: 700, cursor: "pointer",
              transition: "all 0.2s", fontFamily: "var(--font-body)",
            }}
            onMouseOver={e => { e.currentTarget.style.borderColor = "rgba(16,185,129,0.5)"; e.currentTarget.style.color = "#10b981"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseOut={e => { e.currentTarget.style.borderColor = "rgba(148,163,184,0.25)"; e.currentTarget.style.color = "#e2e8f0"; e.currentTarget.style.transform = "translateY(0)"; }}
          >
            Submit Invoice
          </button>
        </div>

        {/* STATS ROW */}
        <div style={{
          display: "flex", gap: 48, marginTop: 80, flexWrap: "wrap", justifyContent: "center",
        }}>
          {[
            { value: "5-12%", label: "Annual Yield" },
            { value: "Token-2022", label: "Solana Standard" },
            { value: "< 90 days", label: "Invoice Term" },
            { value: "On-Chain", label: "KYC Verification" },
          ].map((s) => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#10b981", letterSpacing: "-0.02em" }}>{s.value}</div>
              <div style={{ fontSize: 13, color: "#64748b", fontWeight: 500, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </main>

      {/* FEATURES SECTION */}
      <section id="features" style={{
        position: "relative", zIndex: 5,
        maxWidth: 1100, margin: "0 auto", padding: "80px 32px",
      }}>
        <h2 style={{ fontSize: "clamp(1.5rem, 2.5vw + 0.5rem, 2.25rem)", fontWeight: 700, textAlign: "center", marginBottom: 48, letterSpacing: "-0.02em" }}>
          Why <span style={{ color: "#10b981" }}>RWA Platform</span>?
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          {[
            {
              icon: "🔐",
              title: "Compliant by Design",
              desc: "On-chain KYC via Sumsub with Transfer Hook enforcement. Every token transfer is verified.",
            },
            {
              icon: "🏦",
              title: "Senior / Junior Tranching",
              desc: "Institutional-grade waterfall model. Senior investors get paid first, junior earns higher yield.",
            },
            {
              icon: "⚡",
              title: "Instant Settlement",
              desc: "Solana's sub-second finality. Fund invoices, claim returns, all on-chain with Token-2022.",
            },
          ].map((f) => (
            <div key={f.title} style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 16, padding: "32px 28px",
              transition: "border-color 0.2s, background 0.2s",
            }}
              onMouseOver={e => { e.currentTarget.style.borderColor = "rgba(16,185,129,0.2)"; e.currentTarget.style.background = "rgba(16,185,129,0.03)"; }}
              onMouseOut={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
            >
              <div style={{ fontSize: 32, marginBottom: 16 }}>{f.icon}</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.7 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" style={{
        position: "relative", zIndex: 5,
        maxWidth: 900, margin: "0 auto", padding: "40px 32px 100px",
      }}>
        <h2 style={{ fontSize: "clamp(1.5rem, 2.5vw + 0.5rem, 2.25rem)", fontWeight: 700, textAlign: "center", marginBottom: 48, letterSpacing: "-0.02em" }}>
          How It <span style={{ color: "#10b981" }}>Works</span>
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {[
            { step: "01", title: "Supplier submits invoice", desc: "Upload or import from EDO. Document hash stored on-chain." },
            { step: "02", title: "Investors fund the invoice", desc: "Choose Senior or Junior tranche, deposit USDT, receive Token-2022 tokens." },
            { step: "03", title: "Platform advances 90%", desc: "Supplier gets immediate liquidity. Admin triggers advance from vault." },
            { step: "04", title: "Debtor repays", desc: "Payment confirmed off-chain. Admin settles on-chain with interest." },
            { step: "05", title: "Investors claim returns", desc: "Burn tokens, receive principal + yield. Senior paid first (waterfall)." },
          ].map((s, i) => (
            <div key={s.step} style={{
              display: "flex", gap: 24, alignItems: "flex-start",
              padding: "24px 0",
              borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.06)" : "none",
            }}>
              <div style={{
                fontSize: 13, fontWeight: 700, color: "#10b981",
                background: "rgba(16,185,129,0.1)", borderRadius: 10,
                padding: "6px 12px", flexShrink: 0, fontVariantNumeric: "tabular-nums",
              }}>{s.step}</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{s.title}</div>
                <div style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.6 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{
        position: "relative", zIndex: 5,
        borderTop: "1px solid rgba(255,255,255,0.06)",
        padding: "24px 32px", textAlign: "center",
        color: "#475569", fontSize: 13,
      }}>
        Built on Solana &middot; AIFC/AFSA Compliant &middot; Colosseum 2026
      </footer>
    </div>
  );
}
