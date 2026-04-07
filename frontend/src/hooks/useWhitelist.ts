import { useEffect, useState, useCallback } from "react";
import { useInvoiceProgram } from "./useInvoice";
export function useWhitelist(wallet?: string) {
  const { isWhitelisted: checkWhitelist } = useInvoiceProgram();
  const [isWhitelisted, setIsWhitelisted] = useState(false);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(() => {
    if (!wallet) return;
    checkWhitelist(wallet).then(setIsWhitelisted).finally(() => setLoading(false));
  }, [wallet]);
  useEffect(() => { refetch(); }, [refetch]);
  return { isWhitelisted, loading, refetch };
}
