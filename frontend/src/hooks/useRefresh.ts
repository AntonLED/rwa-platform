import { useCallback, useEffect, useState } from "react";

type Listener = () => void;
const listeners = new Set<Listener>();

/** Call this to notify all subscribers that data has changed. */
export function emitRefresh() {
  listeners.forEach((fn) => fn());
}

/** Returns a `tick` counter that increments on every emitRefresh(). Use as useEffect dependency. */
export function useRefreshListener(): number {
  const [tick, setTick] = useState(0);

  const bump = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    listeners.add(bump);
    return () => { listeners.delete(bump); };
  }, [bump]);

  return tick;
}
