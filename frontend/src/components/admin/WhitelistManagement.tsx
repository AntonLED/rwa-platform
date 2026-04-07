import { useEffect, useState } from "react";
import { useRefreshListener } from "../../hooks/useRefresh";

interface WhitelistEntry {
  wallet: string;
  kycId: string;
  countryCode: string;
  isActive: boolean;
  whitelistedAt: number;
}

export default function WhitelistManagement() {
  const [entries, setEntries] = useState<WhitelistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tick = useRefreshListener();

  useEffect(() => {
    setLoading(true);
    fetch("/api/whitelist")
      .then(r => r.json())
      .then(d => setEntries(d.entries ?? []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [tick]);

  async function handleRevoke(wallet: string) {
    const reason = window.prompt(`Reason for revoking ${wallet.slice(0, 12)}...?`);
    if (!reason) return;
    setRevoking(wallet);
    setError(null);
    try {
      const res = await fetch(`/api/whitelist/${wallet}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEntries(prev => prev.map(e => e.wallet === wallet ? { ...e, isActive: false } : e));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRevoking(null);
    }
  }

  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 48 }} />)}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: "var(--text-base)", fontWeight: 700 }}>KYC Whitelist</h2>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
            {entries.filter(e => e.isActive).length} active · {entries.filter(e => !e.isActive).length} revoked
          </p>
        </div>
      </div>

      {error && <div className="alert alert-error">⚠ {error}</div>}

      {entries.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔒</div>
          <h3>No whitelisted wallets</h3>
          <p>KYC approvals via Sumsub webhook will appear here.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Wallet</th>
                <th>KYC ID</th>
                <th>Country</th>
                <th>Status</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => (
                <tr key={entry.wallet}>
                  <td>
                    <span style={{ fontFamily: "monospace", fontSize: "var(--text-xs)" }}>
                      {entry.wallet.slice(0, 8)}...{entry.wallet.slice(-6)}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontFamily: "monospace", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                      {entry.kycId.slice(0, 16)}{entry.kycId.length > 16 ? "..." : ""}
                    </span>
                  </td>
                  <td>{entry.countryCode || "—"}</td>
                  <td>
                    {entry.isActive
                      ? <span className="badge badge-green">Active</span>
                      : <span className="badge badge-red">Revoked</span>}
                  </td>
                  <td style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                    {new Date(entry.whitelistedAt * 1000).toLocaleDateString()}
                  </td>
                  <td>
                    {entry.isActive && (
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: "var(--error)", borderColor: "var(--error)" }}
                        disabled={revoking === entry.wallet}
                        onClick={() => handleRevoke(entry.wallet)}
                      >
                        {revoking === entry.wallet ? "Revoking..." : "Revoke"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
