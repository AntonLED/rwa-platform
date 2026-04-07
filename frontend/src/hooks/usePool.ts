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
      setPools(data.pools);
    } catch {
      setPools([]);
    } finally {
      setLoading(false);
    }
  }

  async function initPool(riskLevel: number): Promise<string> {
    const baseRateBps = riskLevel === 0 ? 500 : 1200;
    const markupBps = riskLevel === 0 ? 100 : 300;
    const res = await fetch("/api/pools/initialize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ riskLevel, baseRateBps, markupBps }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    await fetchPools();
    return data.tx;
  }

  useEffect(() => { fetchPools(); }, []);

  return { pools, loading, refetch: fetchPools, fetchPools, initPool };
}
