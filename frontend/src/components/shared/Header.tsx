import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useRole, Role } from "../../hooks/useRole";
import { useRef, useState, useEffect } from "react";
import KycOnboarding from "../KycOnboarding";

const NAV: { path: string; label: string; role: Role; emoji: string }[] = [
  { path: "/investor", label: "Investor", role: "investor", emoji: "📈" },
  { path: "/creditor", label: "Supplier", role: "creditor", emoji: "🏭" },
  { path: "/admin", label: "Admin", role: "admin", emoji: "⚙️" },
];

export default function Header() {
  const { publicKey } = useWallet();
  const { role, setRole } = useRole();
  const location = useLocation();
  const navigate = useNavigate();
  const [showKyc, setShowKyc] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  );
  const refetchWhitelistRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const shortKey = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}..${publicKey.toBase58().slice(-4)}`
    : null;

  return (
    <>
      <header style={{
        background: "var(--surface)", borderBottom: "1px solid var(--divider)",
        position: "sticky", top: 0, zIndex: 100, backdropFilter: "blur(12px)",
      }}>
        <div className="container" style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", height: 60 }}>
          {/* LOGO */}
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", textDecoration: "none", flexShrink: 0 }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-label="RWA Platform">
              <rect width="28" height="28" rx="8" fill="var(--primary)" />
              <path d="M7 20V8h7a4 4 0 0 1 0 8h-2l4 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="20" cy="10" r="2" fill="white" opacity="0.6"/>
            </svg>
            <span style={{ fontWeight: 700, fontSize: "var(--text-base)", color: "var(--text)", letterSpacing: "-0.01em" }}>
              RWA <span style={{ color: "var(--primary)" }}>Platform</span>
            </span>
          </Link>

          {/* NAV ROLE SWITCHER */}
          <nav style={{ display: "flex", gap: "var(--space-1)", background: "var(--surface-offset)", padding: "4px", borderRadius: "var(--radius-lg)", marginLeft: "var(--space-4)" }}>
            {NAV.map((n) => {
              const isActive = location.pathname.startsWith(n.path);
              return (
                <button
                  key={n.role}
                  onClick={() => { setRole(n.role); navigate(n.path); }}
                  style={{
                    padding: "6px 16px", borderRadius: "calc(var(--radius-lg) - 2px)",
                    fontSize: "var(--text-sm)", fontWeight: 600,
                    background: isActive ? "var(--surface)" : "transparent",
                    color: isActive ? "var(--text)" : "var(--text-muted)",
                    boxShadow: isActive ? "var(--shadow-sm)" : "none",
                    transition: "all var(--transition)", border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: "6px",
                  }}
                >
                  <span>{n.emoji}</span>{n.label}
                </button>
              );
            })}
          </nav>

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            {/* KYC STATUS */}
            {publicKey && (
              <button
                onClick={() => setShowKyc(!showKyc)}
                className="badge badge-green"
                style={{ cursor: "pointer", border: "none" }}
              >
                ✓ KYC Verified · KZ
              </button>
            )}

            {/* THEME TOGGLE */}
            <button
              onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}
              style={{
                width: 36, height: 36, borderRadius: "var(--radius-lg)",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "var(--surface-offset)", color: "var(--text-muted)",
                border: "1px solid var(--border)", transition: "all var(--transition)",
              }}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>

            {/* WALLET BUTTON */}
            <div style={{ "--wallet-button-background": "var(--primary)", "--wallet-button-color": "var(--primary-fg)" } as any}>
              <WalletMultiButton style={{
                background: "var(--primary)", color: "var(--primary-fg)",
                borderRadius: "var(--radius-lg)", fontSize: "var(--text-sm)",
                fontWeight: 600, height: 36, padding: "0 var(--space-4)",
                border: "none", fontFamily: "var(--font-body)",
              }} />
            </div>
          </div>
        </div>

        {/* KYC PANEL */}
        {showKyc && publicKey && (
          <div style={{ background: "var(--primary-subtle)", borderTop: "1px solid var(--divider)", padding: "var(--space-3) var(--space-6)" }}>
            <KycOnboarding
              wallet={publicKey.toBase58()}
              onKycComplete={() => { refetchWhitelistRef.current?.(); setShowKyc(false); }}
            />
          </div>
        )}
      </header>
    </>
  );
}
