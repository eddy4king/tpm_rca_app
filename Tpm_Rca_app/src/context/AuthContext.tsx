import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";

interface SafeUser {
  id: string;
  username: string;
  email: string;
  role: string;
  is_active: number;
  created_at: string | null;
  last_login_at: string | null;
}

interface AuthContextType {
  user: SafeUser | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  ssoLogin: () => Promise<void>;
  ldapLogin: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isLoading: boolean;
  canEdit: (minRole: "Admin" | "Engineer" | "Technician" | "Viewer") => boolean;
}
const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
  const savedToken = localStorage.getItem("session_token");
  if (savedToken) {
    // Small delay to ensure Tauri backend is ready
    setTimeout(() => validateSession(savedToken), 500);
  } else {
    setIsLoading(false);
  }
}, []);

  async function validateSession(savedToken: string) {
    try {
      const validUser = await invoke<SafeUser>("validate_session", { token: savedToken });
      setUser(validUser);
      setToken(savedToken);
    } catch {
      localStorage.removeItem("session_token");
      await invoke("logout_user", { token: savedToken }).catch(() => {});
    } finally {
      setIsLoading(false);
    }
  }

  async function login(username: string, password: string) {
  try {
    const [loggedInUser, sessionToken] = await invoke<[SafeUser, string]>("login_user", {
      payload: { username, password },
    });
    setUser(loggedInUser);
    setToken(sessionToken);
    localStorage.setItem("session_token", sessionToken);
  } catch (err) {
    throw new Error(String(err));
  }
}

  async function ssoLogin() {
    try {
      // Opens the provider in the browser and begins the localhost listener.
      await invoke<string>("begin_sso_login");
      // Blocks until the browser redirect is processed and the session is ready.
      const [loggedInUser, sessionToken] = await invoke<[SafeUser, string]>("await_sso_login");
      setUser(loggedInUser);
      setToken(sessionToken);
      localStorage.setItem("session_token", sessionToken);
    } catch (err) {
      throw new Error(String(err));
    }
  }

  async function ldapLogin(username: string, password: string) {
    try {
      const [loggedInUser, sessionToken] = await invoke<[SafeUser, string]>("ldap_login", {
        payload: { username, password },
      });
      setUser(loggedInUser);
      setToken(sessionToken);
      localStorage.setItem("session_token", sessionToken);
    } catch (err) {
      throw new Error(String(err));
    }
  }


  async function logout() {
    if (token) {
      await invoke("logout_user", { token }).catch(() => {});
    }
    setUser(null);
    setToken(null);
    localStorage.removeItem("session_token");
  }

  const roleRank: Record<string, number> = {
    Admin: 4,
    Engineer: 3,
    Technician: 2,
    Viewer: 1,
  };

  function canEdit(minRole: "Admin" | "Engineer" | "Technician" | "Viewer"): boolean {
    if (!user) return false;
    return roleRank[user.role] >= roleRank[minRole];
  }

  return (
    <AuthContext.Provider value={{
      user,
      token,
      login,
      ssoLogin,
      ldapLogin,
      logout,
      isAdmin: user?.role === "Admin",
      isLoading,
      canEdit,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}