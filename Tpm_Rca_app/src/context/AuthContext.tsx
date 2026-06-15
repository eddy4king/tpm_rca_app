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
  logout: () => Promise<void>;
  isAdmin: boolean;
  isLoading: boolean;
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


  async function logout() {
    if (token) {
      await invoke("logout_user", { token }).catch(() => {});
    }
    setUser(null);
    setToken(null);
    localStorage.removeItem("session_token");
  }

  return (
    <AuthContext.Provider value={{
      user,
      token,
      login,
      logout,
      isAdmin: user?.role === "Admin",
      isLoading,
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