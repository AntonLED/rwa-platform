import { useState } from "react";
export type Role = "investor" | "creditor" | "admin";
export function useRole() {
  const [role, setRole] = useState<Role>("investor");
  return { role, setRole };
}
