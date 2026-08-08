import { useState, useEffect } from "react";
import projectImage from "../../project-image.png";
import { invoke } from "@tauri-apps/api/core";
import { useAuth } from "../context/AuthContext";
import {
  Wrench, Eye, EyeOff, Shield, KeyRound, ArrowLeft, XCircle, CheckCircle2,
} from "lucide-react";

type Mode = "loading" | "setup" | "login" | "forgot_username" | "forgot_answer" | "forgot_reset";

interface SsoConfig {
  enabled: boolean;
  label: string;
  issuer: string;
}

interface LdapConfig {
  enabled: boolean;
  label: string;
}

function LoginPage() {
  const { login, ssoLogin, ldapLogin } = useAuth();
  const [mode, setMode] = useState<Mode>("loading");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [ldapLoading, setLdapLoading] = useState(false);
  const [ldapUser, setLdapUser] = useState("");
  const [ldapPass, setLdapPass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [ssoConfig, setSsoConfig] = useState<SsoConfig>({ enabled: false, label: "Single Sign-On", issuer: "" });
  const [ldapConfig, setLdapConfig] = useState<LdapConfig>({ enabled: false, label: "LDAP" });

  // Forgot password flow state
  const [forgotUsername, setForgotUsername] = useState("");
  const [recoveryQuestion, setRecoveryQuestion] = useState<string | null>(null);
  const [recoveryAnswer, setRecoveryAnswer] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  useEffect(() => { checkSetup(); }, []);

  async function checkSetup() {
    try {
      localStorage.removeItem("session_token");
      await invoke("clear_all_sessions").catch(() => {});
      const [hasUsers, sso, ldap] = await Promise.all([
        invoke<boolean>("has_users"),
        invoke<SsoConfig>("get_sso_config").catch(() => ({ enabled: false, label: "Single Sign-On", issuer: "" })),
        invoke<LdapConfig>("get_ldap_config").catch(() => ({ enabled: false, label: "LDAP" })),
      ]);
      setSsoConfig(sso);
      setLdapConfig(ldap);
      setMode(hasUsers ? "login" : "setup");
    } catch {
      setMode("setup");
    }
  }

  async function handleSso() {
    setSsoLoading(true);
    setError(null);
    try {
      await ssoLogin();
    } catch (err) {
      setError(String(err));
      setSsoLoading(false);
    }
  }

  async function handleLdap() {
    if (!ldapUser || !ldapPass) { setError("LDAP username and password are required."); return; }
    setLdapLoading(true);
    setError(null);
    try {
      await ldapLogin(ldapUser, ldapPass);
    } catch (err) {
      setError(String(err));
      setLdapLoading(false);
    }
  }

  async function handleSetup() {
    if (!username || !email || !password) { setError("All fields are required."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    try {
      setLoading(true);
      setError(null);
      await invoke("setup_admin", { username, email, password });
      setSuccess("Admin account created. You can now log in.");
      setEmail("");
      setConfirmPassword("");
      setMode("login");
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

  async function handleForgotLookup() {
    if (!forgotUsername) { setError("Please enter your username."); return; }
    try {
      setLoading(true);
      setError(null);
      const question = await invoke<string | null>("get_recovery_question", { username: forgotUsername });
      if (!question) {
        setError("No recovery question set for this account. Contact your administrator.");
        return;
      }
      setRecoveryQuestion(question);
      setMode("forgot_answer");
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotReset() {
    if (!newPassword) { setError("Password cannot be empty."); return; }
    if (newPassword !== confirmNewPassword) { setError("Passwords do not match."); return; }
    try {
      setLoading(true);
      setError(null);
      await invoke("verify_recovery_answer", {
        payload: {
          username: forgotUsername,
          answer: recoveryAnswer,
          newPassword: newPassword,
        },
      });
      setSuccess("Password reset successfully. You can now log in.");
      setMode("login");
      setForgotUsername("");
      setRecoveryQuestion(null);
      setRecoveryAnswer("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  function resetForgot() {
    setForgotUsername("");
    setRecoveryQuestion(null);
    setRecoveryAnswer("");
    setNewPassword("");
    setConfirmNewPassword("");
    setError(null);
    setMode("login");
  }

  if (mode === "loading") {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center gap-8">
        <img
          src={projectImage}
          alt="TPM-RCA Pro"
          className="w-56 h-80 object-contain rounded-3xl shadow-2xl"
        />
        <div className="flex flex-col gap-6">
          <h1 className="text-4xl font-bold text-white leading-tight">TPM-RCA Pro</h1>
          <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg shadow-blue-500/30">
            <Wrench className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">TPM-RCA Pro</h1>
          <p className="text-slate-400 mt-2 text-sm">Total Productive Maintenance Platform</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-8">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-4 text-sm flex items-center gap-2">
              <XCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
          {success && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl p-3 mb-4 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" /> {success}
            </div>
          )}

          {/* FIRST TIME SETUP */}
          {mode === "setup" && (
            <>
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-blue-600" />
                <h2 className="text-2xl font-bold text-slate-900">First Time Setup</h2>
              </div>
              <p className="text-sm text-slate-500 mb-6">Create the administrator account to get started.</p>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-600 block mb-1.5">Username</label>
                  <input placeholder="Username *" value={username} onChange={e => setUsername(e.target.value)} className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600 block mb-1.5">Email</label>
                  <input placeholder="Email *" type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div className="relative">
                  <label className="text-sm font-medium text-slate-600 block mb-1.5">Password</label>
                  <input placeholder="Password *" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-9 text-slate-400 hover:text-slate-600">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600 block mb-1.5">Confirm Password</label>
                  <input placeholder="Confirm Password *" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
              </div>
              <button onClick={handleSetup} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 rounded-xl font-medium mt-6 transition-colors duration-150">
                {loading ? "Creating..." : "Create Admin Account"}
              </button>
            </>
          )}

          {/* LOGIN */}
          {mode === "login" && (
            <>
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Sign In</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-600 block mb-1.5">Username</label>
                  <input placeholder="Enter your username" value={username} onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600 block mb-1.5">Password</label>
                  <div className="relative">
                    <input placeholder="Enter your password" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <button onClick={handleLogin} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 rounded-xl font-medium mt-6 transition-colors duration-150">
                {loading ? "Signing in..." : "Sign In"}
              </button>
              {ssoConfig.enabled && (
                <>
                  <div className="flex items-center gap-3 my-4">
                    <div className="h-px flex-1 bg-slate-200" />
                    <span className="text-xs text-slate-400">or</span>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>
                  <button onClick={handleSso} disabled={ssoLoading} className="w-full bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 py-3 rounded-xl font-medium transition-colors duration-150">
                    {ssoLoading ? "Waiting for authentication…" : `Sign in with ${ssoConfig.label}`}
                  </button>
                </>
              )}

              {ldapConfig.enabled && (
                <div className="mt-6 pt-6 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-500 mb-3">Sign in with {ldapConfig.label}</p>
                  <div className="space-y-3">
                    <input placeholder="LDAP username" value={ldapUser} onChange={e => setLdapUser(e.target.value)} className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    <div className="relative">
                      <input placeholder="LDAP password" type={showPassword ? "text" : "password"} value={ldapPass} onChange={e => setLdapPass(e.target.value)} className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <button onClick={handleLdap} disabled={ldapLoading} className="w-full bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 py-3 rounded-xl font-medium transition-colors duration-150">
                      {ldapLoading ? "Authenticating…" : `Sign in with ${ldapConfig.label}`}
                    </button>
                  </div>
                </div>
              )}
              <button onClick={() => { setMode("forgot_username"); setError(null); }} className="text-xs text-blue-600 hover:text-blue-700 text-center w-full mt-3">
                Forgot password?
              </button>
              <p className="text-xs text-slate-400 text-center mt-3">Contact your administrator to create an account.</p>
            </>
          )}

          {/* FORGOT — STEP 1: Enter Username */}
          {mode === "forgot_username" && (
            <>
              <button onClick={resetForgot} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
                <ArrowLeft className="w-4 h-4" /> Back to Sign In
              </button>
              <div className="flex items-center gap-2 mb-2">
                <KeyRound className="w-5 h-5 text-amber-500" />
                <h2 className="text-2xl font-bold text-slate-900">Forgot Password</h2>
              </div>
              <p className="text-sm text-slate-500 mb-6">Enter your username to look up your recovery question.</p>
              <input
                placeholder="Your username *"
                value={forgotUsername}
                onChange={e => setForgotUsername(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleForgotLookup()}
                className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
              <button onClick={handleForgotLookup} disabled={loading} className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 rounded-xl font-medium mt-4 transition-colors duration-150">
                {loading ? "Looking up..." : "Continue"}
              </button>
            </>
          )}

          {/* FORGOT — STEP 2: Answer Recovery Question */}
          {mode === "forgot_answer" && (
            <>
              <button onClick={() => { setMode("forgot_username"); setError(null); }} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <div className="flex items-center gap-2 mb-2">
                <KeyRound className="w-5 h-5 text-amber-500" />
                <h2 className="text-2xl font-bold text-slate-900">Security Question</h2>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
                <p className="text-sm font-medium text-slate-700">{recoveryQuestion}</p>
              </div>
              <input
                placeholder="Your answer *"
                type="password"
                value={recoveryAnswer}
                onChange={e => setRecoveryAnswer(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-slate-600 block mb-1.5">New Password</label>
                  <input
                    placeholder="New Password *"
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>
                <div className="relative">
                  <label className="text-sm font-medium text-slate-600 block mb-1.5">Confirm New Password</label>
                  <input
                    placeholder="Confirm New Password *"
                    type={showPassword ? "text" : "password"}
                    value={confirmNewPassword}
                    onChange={e => setConfirmNewPassword(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm pr-12 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-9 text-slate-400 hover:text-slate-600">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button onClick={handleForgotReset} disabled={loading} className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 rounded-xl font-medium mt-4 transition-colors duration-150">
                {loading ? "Resetting..." : "Reset Password"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
