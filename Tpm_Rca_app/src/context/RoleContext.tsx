// RoleContext.tsx – provides role‑based permissions to the UI
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAuth } from "./AuthContext";

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
  const { user } = useAuth();
  const [role, setRole] = useState<RoleInfo>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Map the logged‑in user to their role's permission set.
    const fetchRole = async () => {
      // No authenticated user yet – nothing to resolve.
      if (!user) {
        setRole(undefined);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const roles: RoleInfo[] = await invoke("get_role_permissions");
        // Match the current user's role name to the returned definitions.
        const matched = roles.find(
          (r) => r.name.toLowerCase() === (user.role ?? "").toLowerCase()
        );
        // Fall back to a safe read-only role if no match is found.
        setRole(
          matched ?? {
            name: user.role ?? "Viewer",
            description: "Fallback role",
            permissions: [],
          }
        );
      } catch (e) {
        console.error("Failed to load role permissions", e);
        setRole(undefined);
      } finally {
        setLoading(false);
      }
    };
    fetchRole();
  }, [user]);

  return (
    <RoleContext.Provider value={{ role, loading }}>
      {children}
    </RoleContext.Provider>
  );
};
