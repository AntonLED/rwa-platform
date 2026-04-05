import { useEffect, useState } from "react";

export interface PoolInfo {
  riskLevel: number;
  baseRateBps: number;
  markupBps: number;
  totalInvoices: string;
  totalFunded: string;
  authority: string;
}

export function usePool() {
  const [pools, setPools] = useState<PoolInfo[]>([]);
  const [loading, setLoading] = useState(false);

  async function fetchPools() {
    setLoading(true);
    try {
      const res = await fetch("/api/pools");
      const data = await res.json();
      setPools(data.pools || []);
    } catch {
      setPools([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPools();
  }, []);

  return { pools, loading, refetch: fetchPools };
}
