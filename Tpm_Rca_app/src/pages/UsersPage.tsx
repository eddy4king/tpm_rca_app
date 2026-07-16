import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAuth } from "../context/AuthContext";
import {
  Plus, Pencil, Trash2, Shield,
  CheckCircle2, XCircle, Key, Eye, EyeOff,
} from "lucide-react";
import {
  PageHeader, Card, Input, Select, Button, IconButton, Badge,
  StatCard, Modal, ConfirmDialog, LoadingState, Banner, Field,
  TableCard, tableHeadClass, thClass, tdClass, trClass,
} from "../components/ui";

interface SafeUser {
  id: string;
  username: string;
  email: string;
  role: string;
  is_active: number;
  created_at: string | null;
  last_login_at: string | null;
}

const roleStyles: Record<string, string> = {
  Admin: "bg-red-100 text-red-700 border-red-200",
  Engineer: "bg-blue-100 text-blue-700 border-blue-200",
  Technician: "bg-amber-100 text-amber-700 border-amber-200",
  Viewer: "bg-slate-100 text-slate-600 border-slate-200",
};

const rolePermissions: Record<string, string> = {
  Admin: "Full access — manage users, all modules, sync settings",
  Engineer: "RCA, CAPA, PM Scheduler, Dashboard, Downtime — read/write",
  Technician: "Downtime Logger, PM Scheduler — read/write. Others read-only",
  Viewer: "Read-only access to all modules",
};

const recoveryQuestions = [
  "What was the name of your first pet?",
  "What is your mother's maiden name?",
  "What city were you born in?",
  "What was the name of your first school?",
  "What is your oldest sibling's middle name?",
  "What was your childhood nickname?",
];

function UsersPage() {
  const { user: currentUser, isAdmin } = useAuth();
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<SafeUser | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<SafeUser | null>(null);
  const [showRecoverySetup, setShowRecoverySetup] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SafeUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [createForm, setCreateForm] = useState({
    username: "", email: "", password: "", role: "Viewer",
  });

  const [editForm, setEditForm] = useState({
    username: "", email: "", role: "Viewer", is_active: 1,
  });

  const [resetForm, setResetForm] = useState({
    new_password: "", confirm_password: "",
  });

  const [recoveryForm, setRecoveryForm] = useState({
    question: recoveryQuestions[0],
    answer: "", confirm_answer: "",
  });

  const [changePasswordForm, setChangePasswordForm] = useState({
    current_password: "", new_password: "", confirm_password: "",
  });

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    try {
      setLoading(true);
      const data = await invoke<SafeUser[]>("get_all_users");
      setUsers(data);
      setLoading(false);
    } catch (err) {
      setError(String(err));
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!createForm.username || !createForm.email || !createForm.password) {
      setError("Username, email and password are required.");
      return;
    }
    try {
      await invoke("register_user", {
        payload: {
          username: createForm.username,
          email: createForm.email,
          password: createForm.password,
          role: createForm.role,
        },
      });
      setCreateForm({ username: "", email: "", password: "", role: "Viewer" });
      setShowCreateForm(false);
      showMsg("User created successfully.", "success");
      loadUsers();
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleUpdate() {
    if (!editingUser) return;
    try {
      await invoke("update_user", {
        payload: {
          id: editingUser.id,
          username: editForm.username || null,
          email: editForm.email || null,
          role: editForm.role || null,
          isActive: editForm.is_active,
        },
      });
      setEditingUser(null);
      showMsg("User updated successfully.", "success");
      loadUsers();
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleAdminResetPassword() {
    if (!resetPasswordUser) return;
    if (!resetForm.new_password) { setError("Password cannot be empty."); return; }
    if (resetForm.new_password !== resetForm.confirm_password) {
      setError("Passwords do not match.");
      return;
    }
    try {
      await invoke("admin_reset_password", {
        payload: {
          userId: resetPasswordUser.id,
          newPassword: resetForm.new_password,
        },
      });
      setResetPasswordUser(null);
      setResetForm({ new_password: "", confirm_password: "" });
      showMsg(`Password reset for ${resetPasswordUser.username}.`, "success");
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleSetRecovery() {
    if (!recoveryForm.answer) { setError("Answer cannot be empty."); return; }
    if (recoveryForm.answer !== recoveryForm.confirm_answer) {
      setError("Answers do not match.");
      return;
    }
    try {
      await invoke("set_recovery_question", {
        payload: {
          userId: currentUser?.id,
          question: recoveryForm.question,
          answer: recoveryForm.answer,
        },
      });
      setShowRecoverySetup(false);
      setRecoveryForm({ question: recoveryQuestions[0], answer: "", confirm_answer: "" });
      showMsg("Recovery question set successfully.", "success");
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleChangePassword() {
    if (!changePasswordForm.new_password) { setError("New password cannot be empty."); return; }
    if (changePasswordForm.new_password !== changePasswordForm.confirm_password) {
      setError("New passwords do not match.");
      return;
    }
    try {
      await invoke("change_own_password", {
        payload: {
          userId: currentUser?.id,
          currentPassword: changePasswordForm.current_password,
          newPassword: changePasswordForm.new_password,
        },
      });
      setShowChangePassword(false);
      setChangePasswordForm({ current_password: "", new_password: "", confirm_password: "" });
      showMsg("Password changed successfully.", "success");
    } catch (err) {
      setError(String(err));
    }
  }

  function openEdit(u: SafeUser) {
    setEditingUser(u);
    setEditForm({ username: u.username, email: u.email, role: u.role, is_active: u.is_active });
  }

  function showMsg(msg: string, type: "success" | "error") {
    if (type === "success") { setSuccess(msg); setTimeout(() => setSuccess(null), 4000); }
    else { setError(msg); }
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col bg-slate-50 text-slate-800" style={{ height: "100%" }}>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <PageHeader title="My Account" subtitle="Manage your password and recovery settings" />
          <div className="max-w-md space-y-4">
            {error && (
              <Banner tone="error">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4" />{error}
                  <button onClick={() => setError(null)} className="ml-auto">✕</button>
                </div>
              </Banner>
            )}
            {success && (
              <Banner tone="success">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />{success}
                </div>
              </Banner>
            )}
            <Card>
              <h3 className="font-bold mb-1">Logged in as</h3>
              <p className="text-slate-600">{currentUser?.username}</p>
              <div className="mt-2">
                <Badge className={roleStyles[currentUser?.role || ""]}>{currentUser?.role}</Badge>
              </div>
            </Card>
            <Button className="w-full" onClick={() => setShowChangePassword(true)}>
              <Key className="w-4 h-4" /> Change My Password
            </Button>
            <Button variant="secondary" className="w-full" onClick={() => setShowRecoverySetup(true)}>
              <Shield className="w-4 h-4" /> Set Recovery Question
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) return <LoadingState label="Loading Users..." />;

  return (
    <div className="flex flex-col bg-slate-50 text-slate-800" style={{ height: "100%" }}>
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* HEADER */}
        <PageHeader
          title="User Management"
          subtitle="Manage team access and roles"
          actions={
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setShowChangePassword(true)}>
                <Key className="w-4 h-4" /> Change My Password
              </Button>
              <Button variant="secondary" onClick={() => setShowRecoverySetup(true)}>
                <Shield className="w-4 h-4" /> Set Recovery Question
              </Button>
              <Button onClick={() => setShowCreateForm(true)}>
                <Plus className="w-4 h-4" /> Add User
              </Button>
            </div>
          }
        />

        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Users" value={<span className="text-slate-700">{users.length}</span>} />
          <StatCard label="Active" value={<span className="text-emerald-700">{users.filter(u => u.is_active).length}</span>} />
          <StatCard label="Inactive" value={<span className="text-red-700">{users.filter(u => !u.is_active).length}</span>} />
          <StatCard label="Admins" value={<span className="text-blue-700">{users.filter(u => u.role === "Admin").length}</span>} />
        </div>

        {error && (
          <Banner tone="error">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4" />{error}
              <button onClick={() => setError(null)} className="ml-auto">✕</button>
            </div>
          </Banner>
        )}
        {success && (
          <Banner tone="success">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />{success}
            </div>
          </Banner>
        )}

        {/* ROLE GUIDE */}
        <Card>
          <h3 className="font-bold mb-3">Role Permissions</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {Object.entries(rolePermissions).map(([role, desc]) => (
              <div key={role} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <Badge className={roleStyles[role]}>{role}</Badge>
                <p className="text-xs text-slate-500 mt-2">{desc}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* USER TABLE */}
        <TableCard>
          <table className="w-full">
            <thead className={tableHeadClass}>
              <tr>
                <th className={thClass}>User</th>
                <th className={thClass}>Role</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>Last Login</th>
                <th className={thClass}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className={trClass}>
                  <td className={tdClass}>
                    <div>
                      <p className="font-semibold text-sm">{u.username}</p>
                      <p className="text-xs text-slate-400">{u.email}</p>
                    </div>
                  </td>
                  <td className={tdClass}>
                    <Badge className={roleStyles[u.role] || "bg-slate-100 text-slate-600 border-slate-200"}>
                      {u.role}
                    </Badge>
                  </td>
                  <td className={tdClass}>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${u.is_active ? "bg-emerald-500" : "bg-slate-300"}`}></span>
                      <span className="text-sm">{u.is_active ? "Active" : "Inactive"}</span>
                    </div>
                  </td>
                  <td className={`${tdClass} text-sm text-slate-500`}>
                    {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : "Never"}
                  </td>
                  <td className={tdClass}>
                    <div className="flex gap-2">
                      <IconButton variant="edit" label="Edit" onClick={() => openEdit(u)}>
                        <Pencil className="w-4 h-4" />
                      </IconButton>
                      <IconButton variant="edit" label="Reset password" onClick={() => { setResetPasswordUser(u); setResetForm({ new_password: "", confirm_password: "" }); }}>
                        <Key className="w-4 h-4" />
                      </IconButton>
                      {u.id !== currentUser?.id && (
                        <IconButton variant="danger" label="Delete" onClick={() => setDeleteTarget(u)}>
                          <Trash2 className="w-4 h-4" />
                        </IconButton>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      </div>

      {/* CREATE USER MODAL */}
      {showCreateForm && (
        <Modal title="Add New User" onClose={() => setShowCreateForm(false)} maxWidth="max-w-md">
          <div className="space-y-4">
            <Field label="Username *"><Input placeholder="Username *" value={createForm.username} onChange={e => setCreateForm({ ...createForm, username: e.target.value })} /></Field>
            <Field label="Email *"><Input placeholder="Email *" type="email" value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} /></Field>
            <Field label="Password *">
              <div className="relative">
                <Input placeholder="Password *" type={showPassword ? "text" : "password"} value={createForm.password} onChange={e => setCreateForm({ ...createForm, password: e.target.value })} className="pr-12" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </Field>
            <Field label="Role">
              <Select value={createForm.role} onChange={e => setCreateForm({ ...createForm, role: e.target.value })}>
                <option value="Viewer">Viewer</option>
                <option value="Technician">Technician</option>
                <option value="Engineer">Engineer</option>
                <option value="Admin">Admin</option>
              </Select>
            </Field>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setShowCreateForm(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create User</Button>
          </div>
        </Modal>
      )}

      {/* EDIT USER MODAL */}
      {editingUser && (
        <Modal title={`Edit User — ${editingUser.username}`} onClose={() => setEditingUser(null)} maxWidth="max-w-md">
          <div className="space-y-4">
            <Field label="Username"><Input placeholder="Username" value={editForm.username} onChange={e => setEditForm({ ...editForm, username: e.target.value })} /></Field>
            <Field label="Email"><Input placeholder="Email" type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} /></Field>
            <Field label="Role">
              <Select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })}>
                <option value="Viewer">Viewer</option>
                <option value="Technician">Technician</option>
                <option value="Engineer">Engineer</option>
                <option value="Admin">Admin</option>
              </Select>
            </Field>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-slate-400">User can log in</p>
              </div>
              <button onClick={() => setEditForm({ ...editForm, is_active: editForm.is_active === 1 ? 0 : 1 })} className={`w-12 h-6 rounded-full transition-colors ${editForm.is_active ? "bg-blue-600" : "bg-slate-300"}`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${editForm.is_active ? "translate-x-6" : "translate-x-0"}`} />
              </button>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setEditingUser(null)}>Cancel</Button>
            <Button onClick={handleUpdate}>Update User</Button>
          </div>
        </Modal>
      )}

      {/* ADMIN RESET PASSWORD MODAL */}
      {resetPasswordUser && (
        <Modal title="Reset Password" onClose={() => setResetPasswordUser(null)} maxWidth="max-w-md">
          <p className="text-sm text-slate-500 mb-4">For: {resetPasswordUser.username}</p>
          <div className="space-y-4">
            <Field label="New Password *">
              <div className="relative">
                <Input placeholder="New Password *" type={showPassword ? "text" : "password"} value={resetForm.new_password} onChange={e => setResetForm({ ...resetForm, new_password: e.target.value })} className="pr-12" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </Field>
            <Field label="Confirm New Password *">
              <Input placeholder="Confirm New Password *" type="password" value={resetForm.confirm_password} onChange={e => setResetForm({ ...resetForm, confirm_password: e.target.value })} />
            </Field>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setResetPasswordUser(null)}>Cancel</Button>
            <Button onClick={handleAdminResetPassword}>Reset Password</Button>
          </div>
        </Modal>
      )}

      {/* SET RECOVERY QUESTION MODAL */}
      {showRecoverySetup && (
        <Modal title="Set Recovery Question" onClose={() => setShowRecoverySetup(false)} maxWidth="max-w-md">
          <p className="text-sm text-slate-500 mb-4">Used to recover your account if you forget your password</p>
          <div className="space-y-4">
            <Field label="Security Question">
              <Select value={recoveryForm.question} onChange={e => setRecoveryForm({ ...recoveryForm, question: e.target.value })}>
                {recoveryQuestions.map(q => <option key={q} value={q}>{q}</option>)}
              </Select>
            </Field>
            <Field label="Your Answer *"><Input placeholder="Your answer *" type="password" value={recoveryForm.answer} onChange={e => setRecoveryForm({ ...recoveryForm, answer: e.target.value })} /></Field>
            <Field label="Confirm Answer *"><Input placeholder="Confirm answer *" type="password" value={recoveryForm.confirm_answer} onChange={e => setRecoveryForm({ ...recoveryForm, confirm_answer: e.target.value })} /></Field>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setShowRecoverySetup(false)}>Cancel</Button>
            <Button onClick={handleSetRecovery}>Save Recovery Question</Button>
          </div>
        </Modal>
      )}

      {/* CHANGE OWN PASSWORD MODAL */}
      {showChangePassword && (
        <Modal title="Change My Password" onClose={() => setShowChangePassword(false)} maxWidth="max-w-md">
          <p className="text-sm text-slate-500 mb-4">Enter your current password to confirm</p>
          <div className="space-y-4">
            <Field label="Current Password *"><Input placeholder="Current Password *" type="password" value={changePasswordForm.current_password} onChange={e => setChangePasswordForm({ ...changePasswordForm, current_password: e.target.value })} /></Field>
            <Field label="New Password *"><Input placeholder="New Password *" type="password" value={changePasswordForm.new_password} onChange={e => setChangePasswordForm({ ...changePasswordForm, new_password: e.target.value })} /></Field>
            <Field label="Confirm New Password *"><Input placeholder="Confirm New Password *" type="password" value={changePasswordForm.confirm_password} onChange={e => setChangePasswordForm({ ...changePasswordForm, confirm_password: e.target.value })} /></Field>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setShowChangePassword(false)}>Cancel</Button>
            <Button onClick={handleChangePassword}>Change Password</Button>
          </div>
        </Modal>
      )}

      {/* DELETE CONFIRMATION */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete User"
        message={deleteTarget ? `Delete user "${deleteTarget.username}"? This cannot be undone.` : ""}
        confirmLabel="Delete"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          if (deleteTarget.id === currentUser?.id) {
            setError("You cannot delete your own account.");
            setDeleteTarget(null);
            return;
          }
          try {
            await invoke("delete_user", { id: deleteTarget.id });
            setUsers(prev => prev.filter(u => u.id !== deleteTarget.id));
            showMsg("User deleted.", "success");
          } catch (err) {
            setError(String(err));
          }
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}

export default UsersPage;
