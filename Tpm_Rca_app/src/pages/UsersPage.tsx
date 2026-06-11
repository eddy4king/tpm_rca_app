import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAuth } from "../context/AuthContext";
import { Users, Plus, Pencil, Trash2, Shield, CheckCircle2, XCircle } from "lucide-react";

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
  Admin: "bg-red-100 text-red-700",
  Engineer: "bg-blue-100 text-blue-700",
  Technician: "bg-amber-100 text-amber-700",
  Viewer: "bg-slate-100 text-slate-600",
};

const rolePermissions: Record<string, string[]> = {
  Admin: ["Full access — manage users, all modules, sync settings"],
  Engineer: ["RCA, CAPA, PM Scheduler, Dashboard, Downtime — read/write"],
  Technician: ["Downtime Logger, PM Scheduler — read/write. Others read-only"],
  Viewer: ["Read-only access to all modules"],
};

function UsersPage() {
  const { user: currentUser, isAdmin } = useAuth();
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<SafeUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    role: "Viewer",
  });
  const [editForm, setEditForm] = useState({
    username: "",
    email: "",
    role: "Viewer",
    is_active: 1,
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
    if (!form.username || !form.email || !form.password) {
      setError("Username, email and password are required.");
      return;
    }
    try {
      await invoke("register_user", {
        payload: {
          username: form.username,
          email: form.email,
          password: form.password,
          role: form.role,
        },
      });
      setForm({ username: "", email: "", password: "", role: "Viewer" });
      setShowForm(false);
      showSuccess("User created successfully.");
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
      showSuccess("User updated successfully.");
      loadUsers();
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleDelete(id: string) {
    if (id === currentUser?.id) { setError("You cannot delete your own account."); return; }
    if (!confirm("Delete this user?")) return;
    try {
      await invoke("delete_user", { id });
      setUsers(prev => prev.filter(u => u.id !== id));
      showSuccess("User deleted.");
    } catch (err) {
      setError(String(err));
    }
  }

  function openEdit(u: SafeUser) {
    setEditingUser(u);
    setEditForm({ username: u.username, email: u.email, role: u.role, is_active: u.is_active });
  }

  function showSuccess(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 4000);
  }

  if (!isAdmin) {
    return (
      <div className="h-screen flex items-center justify-center text-center p-8">
        <div>
          <Shield className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-slate-400">Admin Access Required</h2>
          <p className="text-slate-500 text-sm mt-2">Only administrators can manage users.</p>
        </div>
      </div>
    );
  }

  if (loading) return <div className="h-screen flex items-center justify-center text-slate-500">Loading Users...</div>;

  return (
    <div className="flex flex-col bg-slate-100 text-slate-800" style={{ height: "calc(100vh - 80px)" }}>

      {/* HEADER */}
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-600" />
              <h1 className="text-2xl font-bold">User Management</h1>
            </div>
            <p className="text-sm text-slate-500 mt-1">Manage team access and roles</p>
          </div>
          <button
            onClick={() => { setShowForm(true); setEditingUser(null); }}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-xl font-medium flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add User
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <p className="text-xs text-slate-500">Total Users</p>
            <h2 className="text-3xl font-bold mt-1">{users.length}</h2>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
            <p className="text-xs text-emerald-600">Active</p>
            <h2 className="text-3xl font-bold mt-1 text-emerald-700">{users.filter(u => u.is_active).length}</h2>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
            <p className="text-xs text-red-600">Inactive</p>
            <h2 className="text-3xl font-bold mt-1 text-red-700">{users.filter(u => !u.is_active).length}</h2>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
            <p className="text-xs text-blue-600">Admins</p>
            <h2 className="text-3xl font-bold mt-1 text-blue-700">{users.filter(u => u.role === "Admin").length}</h2>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-4 text-sm flex items-center gap-2">
            <XCircle className="w-4 h-4" /> {error}
            <button onClick={() => setError(null)} className="ml-auto">✕</button>
          </div>
        )}

        {success && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl p-3 mb-4 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> {success}
          </div>
        )}

        {/* ROLE GUIDE */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-5 shadow-sm">
          <h3 className="font-bold mb-3">Role Permissions</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {Object.entries(rolePermissions).map(([role, perms]) => (
              <div key={role} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${roleStyles[role]}`}>{role}</span>
                <p className="text-xs text-slate-500 mt-2">{perms[0]}</p>
              </div>
            ))}
          </div>
        </div>

        {/* USER LIST */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-800 text-white">
              <tr>
                <th className="p-4 text-left text-sm">User</th>
                <th className="p-4 text-left text-sm">Role</th>
                <th className="p-4 text-left text-sm">Status</th>
                <th className="p-4 text-left text-sm">Last Login</th>
                <th className="p-4 text-left text-sm">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-4">
                    <div>
                      <p className="font-semibold text-sm">{u.username}</p>
                      <p className="text-xs text-slate-400">{u.email}</p>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${roleStyles[u.role] || "bg-slate-100 text-slate-600"}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${u.is_active ? "bg-emerald-500" : "bg-slate-300"}`}></span>
                      <span className="text-sm">{u.is_active ? "Active" : "Inactive"}</span>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-slate-500">
                    {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : "Never"}
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(u)} className="p-2 rounded-lg hover:bg-slate-100">
                        <Pencil className="w-4 h-4 text-blue-600" />
                      </button>
                      {u.id !== currentUser?.id && (
                        <button onClick={() => handleDelete(u.id)} className="p-2 rounded-lg hover:bg-red-50">
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE USER MODAL */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-5">Add New User</h2>
            <div className="space-y-4">
              <input
                placeholder="Username *"
                value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value })}
                className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm"
              />
              <input
                placeholder="Email *"
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm"
              />
              <input
                placeholder="Password *"
                type="password"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm"
              />
              <select
                value={form.role}
                onChange={e => setForm({ ...form, role: e.target.value })}
                className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm"
              >
                <option value="Viewer">Viewer</option>
                <option value="Technician">Technician</option>
                <option value="Engineer">Engineer</option>
                <option value="Admin">Admin</option>
              </select>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl border border-slate-300 hover:bg-slate-50 text-sm">Cancel</button>
              <button onClick={handleCreate} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl text-sm font-medium">Create User</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-5">Edit User</h2>
            <div className="space-y-4">
              <input
                placeholder="Username"
                value={editForm.username}
                onChange={e => setEditForm({ ...editForm, username: e.target.value })}
                className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm"
              />
              <input
                placeholder="Email"
                type="email"
                value={editForm.email}
                onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm"
              />
              <select
                value={editForm.role}
                onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm"
              >
                <option value="Viewer">Viewer</option>
                <option value="Technician">Technician</option>
                <option value="Engineer">Engineer</option>
                <option value="Admin">Admin</option>
              </select>
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <p className="text-sm font-medium">Active</p>
                  <p className="text-xs text-slate-400">User can log in</p>
                </div>
                <button
                  onClick={() => setEditForm({ ...editForm, is_active: editForm.is_active === 1 ? 0 : 1 })}
                  className={`w-12 h-6 rounded-full transition-colors ${editForm.is_active ? "bg-blue-600" : "bg-slate-300"}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${editForm.is_active ? "translate-x-6" : "translate-x-0"}`} />
                </button>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditingUser(null)} className="flex-1 py-3 rounded-xl border border-slate-300 hover:bg-slate-50 text-sm">Cancel</button>
              <button onClick={handleUpdate} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl text-sm font-medium">Update User</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UsersPage;