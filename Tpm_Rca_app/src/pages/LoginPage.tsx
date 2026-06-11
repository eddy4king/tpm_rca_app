import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAuth } from "../context/AuthContext";
import { Wrench, Eye, EyeOff, Shield } from "lucide-react";

function LoginPage() {
  const { login } = useAuth();
  const [mode, setMode] = useState<"loading" | "setup" | "login">("loading");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => { checkSetup(); }, []);

 /* async function checkSetup() {
    try {
      await invoke("setup_admin", {
        username: "__check__",
        email: "__check__",
        password: "__check__",
      });
      setMode("setup");
    } catch (err) {
      const msg = String(err);
      if (msg.includes("Setup already complete")) {
        setMode("login");
      } else {
        setMode("setup");
      }
    }
  }*/
   async function checkSetup() {
        try {
            localStorage.removeItem("session_token");
            await invoke("clear_all_sessions").catch(() => {});
            const hasUsers = await invoke<boolean>("has_users");
            setMode(hasUsers ? "login" : "setup");
        } catch (err) {
            setMode("login");
        }
        }
  /*async function handleSetup() {
    if (!username || !email || !password) { setError("All fields are required."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    try {
      setLoading(true);
      setError(null);
      await invoke("setup_admin", { username, email, password });
      setSuccess("Admin account created. You can now log in.");
      setMode("login");
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }*/

    async function handleSetup() {
        if (!username || !email || !password) { setError("All fields are required."); return; }
        if (password !== confirmPassword) { setError("Passwords do not match."); return; }
        try {
            setLoading(true);
            setError(null);
            await invoke("setup_admin", { username, email, password });
            setSuccess("Admin account created. You can now log in.");
            // Keep username, only clear sensitive fields
            setEmail("");
            setConfirmPassword("");
            setMode("login");
            // Don't clear password — let user log in immediately
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
        }

  async function handleLogin() {
    if (!username || !password) { setError("Please enter username and password."); return; }
    try {
      setLoading(true);
      setError(null);
      await login(username, password);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  if (mode === "loading") {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <Wrench className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">TPM-RCA Pro</h1>
          <p className="text-slate-400 mt-2">Total Productive Maintenance Platform</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-8">
          {mode === "setup" ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-blue-600" />
                <h2 className="text-2xl font-bold text-slate-800">First Time Setup</h2>
              </div>
              <p className="text-sm text-slate-500 mb-6">Create the administrator account to get started.</p>

              {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-4 text-sm">{error}</div>}

              <div className="space-y-4">
                <input
                  placeholder="Username *"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm"
                />
                <input
                  placeholder="Email *"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm"
                />
                <div className="relative">
                  <input
                    placeholder="Password *"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm pr-12"
                  />
                  <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3.5 text-slate-400">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <input
                  placeholder="Confirm Password *"
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm"
                />
              </div>
              <button
                onClick={handleSetup}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-3 rounded-xl font-medium mt-6"
              >
                {loading ? "Creating..." : "Create Admin Account"}
              </button>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-slate-800 mb-6">Sign In</h2>

              {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-4 text-sm">{error}</div>}
              {success && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl p-3 mb-4 text-sm">{success}</div>}

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-600 block mb-1">Username</label>
                  <input
                    placeholder="Enter your username"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleLogin()}
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600 block mb-1">Password</label>
                  <div className="relative">
                    <input
                      placeholder="Enter your password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleLogin()}
                      className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm pr-12"
                    />
                    <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3.5 text-slate-400">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-3 rounded-xl font-medium mt-6"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
              <p className="text-xs text-slate-400 text-center mt-4">
                Contact your administrator to create an account.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default LoginPage;