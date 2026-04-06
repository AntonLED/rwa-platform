import { useCallback, useEffect, useState } from "react";

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
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!wallet) return;
    setLoading(true);
    fetch(`/api/whitelist/${wallet}`)
      .then((r) => r.json())
      .then(setStatus)
      .finally(() => setLoading(false));
  }, [wallet, tick]);

  return { status, loading, refetch };
}
