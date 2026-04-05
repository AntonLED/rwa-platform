import { useState } from "react";

export type Role = "investor" | "creditor" | "admin";

const STORAGE_KEY = "rwa-role";

export function useRole() {
  const [role, setRoleState] = useState<Role>(
    () => (localStorage.getItem(STORAGE_KEY) as Role) || "investor"
  );

  function setRole(r: Role) {
    localStorage.setItem(STORAGE_KEY, r);
    setRoleState(r);
  }

  return { role, setRole };
}
