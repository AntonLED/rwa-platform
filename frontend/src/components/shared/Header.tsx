import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useRole, Role } from "../../hooks/useRole";
import WalletStatus from "../WalletStatus";
import { useState } from "react";
import KycOnboarding from "../KycOnboarding";

const NAV: { path: string; label: string; role: Role }[] = [
  { path: "/investor", label: "Investor", role: "investor" },
  { path: "/creditor", label: "Creditor", role: "creditor" },
  { path: "/admin", label: "Admin", role: "admin" },
];

export default function Header() {
  const { publicKey } = useWallet();
  const { role, setRole } = useRole();
  const location = useLocation();
  const navigate = useNavigate();
  const [showKyc, setShowKyc] = useState(false);

  return (
    <header style={{ borderBottom: "1px solid #e0e0e0", paddingBottom: 12, marginBottom: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 22 }}>RWA Platform</h1>

        <nav style={{ display: "flex", gap: 4 }}>
          {NAV.map((n) => (
            <Link
              key={n.path}
              to={n.path}
              onClick={() => setRole(n.role)}
              style={{
                padding: "6px 16px",
                borderRadius: 6,
                textDecoration: "none",
                background: location.pathname.startsWith(n.path) ? "#1976d2" : "#e0e0e0",
                color: location.pathname.startsWith(n.path) ? "#fff" : "#333",
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <select
            value={role}
            onChange={(e) => {
              const r = e.target.value as Role;
              setRole(r);
              navigate(`/${r}`);
            }}
            style={{ padding: "6px 8px", borderRadius: 4, border: "1px solid #ccc", fontSize: 13 }}
          >
            <option value="investor">Investor</option>
            <option value="creditor">Creditor</option>
            <option value="admin">Admin</option>
          </select>
          <WalletMultiButton />
        </div>
      </div>

      {publicKey && (
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <WalletStatus wallet={publicKey.toBase58()} />
          <button
            onClick={() => setShowKyc(!showKyc)}
            style={{
              padding: "4px 12px",
              border: "1px solid #512da8",
              borderRadius: 4,
              background: showKyc ? "#512da8" : "transparent",
              color: showKyc ? "#fff" : "#512da8",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {showKyc ? "Hide KYC" : "KYC"}
          </button>
        </div>
      )}
      {showKyc && publicKey && (
        <KycOnboarding wallet={publicKey.toBase58()} />
      )}
    </header>
  );
}
