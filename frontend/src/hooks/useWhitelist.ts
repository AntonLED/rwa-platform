import { useEffect, useState } from "react";

export interface WhitelistStatus {
  whitelisted: boolean;
  active: boolean;
  kycId?: string;
  countryCode?: string;
  whitelistedAt?: number;
}

export function useWhitelist(wallet: string | null) {
  const [status, setStatus] = useState<WhitelistStatus | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!wallet) return;
    setLoading(true);
    fetch(`/api/whitelist/${wallet}`)
      .then((r) => r.json())
      .then(setStatus)
      .finally(() => setLoading(false));
  }, [wallet]);

  return { status, loading, refetch: () => setStatus(null) };
}
