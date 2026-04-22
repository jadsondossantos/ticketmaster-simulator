import { useEffect, useState } from "react";

const STORAGE_KEY = "ADMIN_API_KEY";

export function useAdminKey() {
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem(STORAGE_KEY) ?? "dev-admin-key");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, adminKey);
  }, [adminKey]);

  return [adminKey, setAdminKey] as const;
}

