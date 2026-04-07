import { useState, useEffect } from "react";
let listeners: (() => void)[] = [];
export function emitRefresh() { listeners.forEach(fn => fn()); }
export function useRefreshListener() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const fn = () => setTick(t => t + 1);
    listeners.push(fn);
    return () => { listeners = listeners.filter(l => l !== fn); };
  }, []);
  return tick;
}
