import { useWhitelist } from "../hooks/useWhitelist";
import { useEffect } from "react";

interface Props {
  wallet: string;
  onRefetchReady?: (refetch: () => void) => void;
}

export default function WalletStatus({ wallet, onRefetchReady }: Props) {
  const { status, loading, refetch } = useWhitelist(wallet);

  useEffect(() => {
    onRefetchReady?.(refetch);
  }, [refetch, onRefetchReady]);

  if (loading) return <p>Checking KYC status…</p>;
  if (!status) return null;

  const color = status.active ? "green" : status.whitelisted ? "orange" : "red";
  const label = status.active
    ? "✅ KYC Verified"
    : status.whitelisted
    ? "⚠️ KYC Revoked"
    : "❌ Not KYC Verified";

  return (
    <div style={{ margin: "16px 0", padding: 12, border: `2px solid ${color}`, borderRadius: 8 }}>
      <strong>{label}</strong>
      {status.countryCode && <span style={{ marginLeft: 8 }}>Country: {status.countryCode}</span>}
      {status.whitelistedAt && (
        <span style={{ marginLeft: 8, fontSize: 12, color: "#666" }}>
          Since: {new Date(status.whitelistedAt * 1000).toLocaleDateString()}
        </span>
      )}
    </div>
  );
}
