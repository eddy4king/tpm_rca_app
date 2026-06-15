// RoleContext.tsx – provides role‑based permissions to the UI
import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface RoleInfo {
  name: string;
  description: string;
  permissions: string[];
}

interface RoleContextProps {
  role?: RoleInfo;
  loading: boolean;
}

const RoleContext = createContext<RoleContextProps>({ loading: true });

export const useRole = () => useContext(RoleContext);

export const RoleProvider = ({ children }: { children: ReactNode }) => {
  const [role, setRole] = useState<RoleInfo>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch role permissions once the app starts (or after login).
    const fetchRole = async () => {
      try {
        const roles: RoleInfo[] = await invoke("get_role_permissions");
        // For now pick the first role (Admin) as placeholder – real app should map
        // the logged‑in user to a role. This demonstrates UI gating.
        if (roles.length) setRole(roles[0]);
      } catch (e) {
        console.error("Failed to load role permissions", e);
      } finally {
        setLoading(false);
      }
    };
    fetchRole();
  }, []);

  return (
    <RoleContext.Provider value={{ role, loading }}>
      {children}
    </RoleContext.Provider>
  );
};
