import { useWallet } from "@solana/wallet-adapter-react";
import { useWhitelist } from "../../hooks/useWhitelist";

export default function WalletStatus({ onRefetch }: { onRefetch?: (fn: () => void) => void }) {
  const { publicKey } = useWallet();
  const { isWhitelisted, loading, refetch } = useWhitelist(publicKey?.toBase58());
  if (onRefetch) onRefetch(refetch);
  if (!publicKey || loading) return null;
  return isWhitelisted
    ? <span className="badge badge-green">✓ KYC on-chain</span>
    : <span className="badge badge-orange">⚠ KYC Pending</span>;
}
