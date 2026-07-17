import { useState, useEffect, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Plus, Pencil, Trash2, Search, Paperclip, Tag, User, Clock,
  BookOpen, X, Lightbulb, DraftingCompass, FileText,
} from "lucide-react";
import {
  PageHeader, Card, Input, Select, Textarea, Button, Modal,
  ConfirmDialog, LoadingState, Banner, StatCard, Badge,
} from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { KnowledgeNote, parseJsonArray } from "../lib/knowledge";

interface Equipment {
  id: string;
  tag_number: string | null;
  name: string | null;
}

interface NoteForm {
  equipment_id: string;
  title: string;
  body: string;
  category: string;
  author: string;
  tags: string[];
  attachments: string[];
  is_draft: boolean;
}

const emptyForm: NoteForm = {
  equipment_id: "",
  title: "",
  body: "",
  category: "",
  author: "",
  tags: [],
  attachments: [],
  is_draft: false,
};

const CATEGORY_OPTIONS = [
  "Fix / Repair", "Troubleshooting", "PM Tip", "Operator Tip",
  "Spare Part", "Safety", "Lessons Learned", "Other",
];

export default function KnowledgePage() {
  const { canEdit } = useAuth();
  const canEditKnowledge = canEdit("Engineer");

  const [notes, setNotes] = useState<KnowledgeNote[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterEquipment, setFilterEquipment] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [onlyDrafts, setOnlyDrafts] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<NoteForm>({ ...emptyForm });
  const [tagInput, setTagInput] = useState("");

  const [viewing, setViewing] = useState<KnowledgeNote | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const eqLabel = useCallback(
    (id: string | null) => {
      if (!id) return "General / Fleet";
      const e = equipment.find((x) => x.id === id);
      return e ? `${e.tag_number} — ${e.name}` : id;
    },
    [equipment]
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [rows, eq] = await Promise.all([
        invoke<KnowledgeNote[]>("search_knowledge_notes", {
          payload: {
            q: search.trim() || null,
            equipmentId: filterEquipment || null,
            category: filterCategory || null,
            tag: null,
            includeDrafts: onlyDrafts || undefined,
            limit: 1000,
          },
        }),
        invoke<Equipment[]>("get_all_equipment"),
      ]);
      setNotes(rows);
      setEquipment(eq);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [search, filterEquipment, filterCategory, onlyDrafts]);

  useEffect(() => {
    load();
  }, [load]);

  function resetForm() {
    setForm({ ...emptyForm });
    setTagInput("");
    setEditingId(null);
  }

  function addTag(raw: string) {
    const t = raw.trim().replace(/,$/, "").trim();
    if (t && !form.tags.includes(t)) {
      setForm((f) => ({ ...f, tags: [...f.tags, t] }));
    }
    setTagInput("");
  }

  function handleTagKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === "Backspace" && !tagInput && form.tags.length) {
      setForm((f) => ({ ...f, tags: f.tags.slice(0, -1) }));
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    const names: string[] = [];
    for (let i = 0; i < files.length; i++) names.push(files[i].name);
    setForm((f) => ({ ...f, attachments: [...f.attachments, ...names] }));
  }

  async function handleSave() {
    if (!form.title.trim()) {
      setError("A title is required.");
      return;
    }
    try {
      if (editingId) {
        await invoke("update_knowledge_note", {
          payload: {
            id: editingId,
            equipmentId: form.equipment_id || null,
            title: form.title,
            body: form.body || null,
            tags: form.tags,
            category: form.category || null,
            author: form.author || null,
            attachments: form.attachments,
            isDraft: form.is_draft,
          },
        });
      } else {
        await invoke("create_knowledge_note", {
          payload: {
            equipmentId: form.equipment_id || null,
            title: form.title,
            body: form.body || null,
            tags: form.tags,
            category: form.category || null,
            author: form.author || null,
            attachments: form.attachments,
            isDraft: form.is_draft,
          },
        });
      }
      await load();
      resetForm();
      setShowForm(false);
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleDelete(id: string) {
    try {
      await invoke("delete_knowledge_note", { id });
      setNotes((prev) => prev.filter((n) => n.id !== id));
      setViewing(null);
    } catch (err) {
      setError(String(err));
    }
  }

  function startEdit(n: KnowledgeNote) {
    setForm({
      equipment_id: n.equipment_id || "",
      title: n.title,
      body: n.body || "",
      category: n.category || "",
      author: n.author || "",
      tags: parseJsonArray(n.tags),
      attachments: parseJsonArray(n.attachments),
      is_draft: n.is_draft === 1,
    });
    setEditingId(n.id);
    setShowForm(true);
  }

  const stats = useMemo(() => {
    const total = notes.length;
    const drafts = notes.filter((n) => n.is_draft === 1).length;
    const tagged = notes.filter((n) => parseJsonArray(n.tags).length > 0).length;
    const assets = new Set(
      notes.map((n) => n.equipment_id).filter((x): x is string => !!x)
    ).size;
    return { total, drafts, tagged, assets };
  }, [notes]);

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    notes.forEach((n) => n.category && set.add(n.category));
    CATEGORY_OPTIONS.forEach((c) => set.add(c));
    return Array.from(set);
  }, [notes]);

  if (loading) return <LoadingState label="Loading tribal knowledge…" />;
  if (error) return <Banner tone="error">{error}</Banner>;

  return (
    <div className="flex flex-col bg-slate-50 text-slate-800" style={{ height: "100%" }}>
      {/* HEADER */}
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <PageHeader
          title="Tribal Knowledge"
          subtitle="Capture how we actually fix things — operator tips, fixes & lessons per asset"
          actions={
            canEditKnowledge ? (
              <Button onClick={() => { resetForm(); setShowForm(true); }}>
                <Plus className="w-4 h-4" /> New Note
              </Button>
            ) : null
          }
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
          <StatCard
            tint="indigo"
            icon={<BookOpen className="w-5 h-5" />}
            label="Knowledge Notes"
            value={<span className="text-slate-900">{stats.total}</span>}
          />
          <StatCard
            tint="amber"
            icon={<DraftingCompass className="w-5 h-5" />}
            label="Drafts"
            value={<span className="text-amber-700">{stats.drafts}</span>}
          />
          <StatCard
            tint="emerald"
            icon={<Tag className="w-5 h-5" />}
            label="Tagged"
            value={<span className="text-emerald-700">{stats.tagged}</span>}
          />
          <StatCard
            tint="sky"
            icon={<Lightbulb className="w-5 h-5" />}
            label="Assets Covered"
            value={<span className="text-sky-700">{stats.assets}</span>}
          />
        </div>

        {/* FILTERS */}
        <Card className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search notes, tips, fixes…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterEquipment} onChange={(e) => setFilterEquipment(e.target.value)}>
              <option value="">All Equipment</option>
              {equipment.map((eq) => (
                <option key={eq.id} value={eq.id}>{eq.tag_number} — {eq.name}</option>
              ))}
            </Select>
            <Select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="">All Categories</option>
              {allCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyDrafts}
                onChange={(e) => setOnlyDrafts(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300"
              />
              Drafts only
            </label>
          </div>
        </Card>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto p-6">
        {notes.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center">
            <div>
              <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-slate-400">No knowledge notes yet</h2>
              <p className="text-sm text-slate-500 mt-2">
                {canEditKnowledge
                  ? "Capture your first fix, tip or lesson learned."
                  : "Notes will appear here once your team starts capturing them."}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
            {notes.map((n) => {
              const tags = parseJsonArray(n.tags);
              const attachments = parseJsonArray(n.attachments);
              return (
                <Card
                  key={n.id}
                  className="hover:shadow-md transition-shadow duration-200 cursor-pointer flex flex-col"
                  onClick={() => setViewing(n)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-slate-900 truncate">{n.title}</h2>
                        {n.is_draft === 1 && (
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200 shrink-0">
                            Draft
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{eqLabel(n.equipment_id)}</p>
                    </div>
                    {canEditKnowledge && (
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="edit" onClick={() => startEdit(n)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => setDeleteId(n.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {n.category && (
                    <Badge className="mt-3 bg-indigo-100 text-indigo-700 border-indigo-200 w-fit">
                      <Tag className="w-3 h-3" /> {n.category}
                    </Badge>
                  )}

                  {n.body && (
                    <p className="text-sm text-slate-500 line-clamp-3 mt-3">{n.body}</p>
                  )}

                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {tags.slice(0, 5).map((t) => (
                        <span key={t} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                          #{t}
                        </span>
                      ))}
                      {tags.length > 5 && (
                        <span className="text-xs text-slate-400">+{tags.length - 5}</span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-xs text-slate-400 mt-auto pt-4">
                    {n.author && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" /> {n.author}
                      </span>
                    )}
                    {attachments.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Paperclip className="w-3 h-3" /> {attachments.length}
                      </span>
                    )}
                    {n.created_at && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {new Date(n.created_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {showForm && canEditKnowledge && (
        <Modal
          title={editingId ? "Edit Knowledge Note" : "New Knowledge Note"}
          onClose={() => { setShowForm(false); resetForm(); }}
          maxWidth="max-w-2xl"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-600 block mb-1.5">Equipment</label>
              <Select
                value={form.equipment_id}
                onChange={(e) => setForm({ ...form, equipment_id: e.target.value })}
              >
                <option value="">General / Fleet (no specific asset)</option>
                {equipment.map((eq) => (
                  <option key={eq.id} value={eq.id}>{eq.tag_number} — {eq.name}</option>
                ))}
              </Select>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-600 block mb-1.5">Title *</label>
              <Input
                placeholder="e.g. Quick fix for repeated E-stop trips"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600 block mb-1.5">Category</label>
              <Select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                <option value="">Select category…</option>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600 block mb-1.5">Author</label>
              <Input
                placeholder="Your name / initials"
                value={form.author}
                onChange={(e) => setForm({ ...form, author: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-600 block mb-1.5">Tags</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {form.tags.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-full">
                    #{t}
                    <button type="button" onClick={() => setForm((f) => ({ ...f, tags: f.tags.filter((x) => x !== t) }))} aria-label={`Remove ${t}`}>
                      <X className="w-3 h-3 text-slate-400 hover:text-red-500" />
                    </button>
                  </span>
                ))}
              </div>
              <Input
                placeholder="Type a tag and press Enter"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKey}
                onBlur={() => tagInput && addTag(tagInput)}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-600 block mb-1.5">How we fixed it / Tip</label>
              <Textarea
                placeholder="Describe the fix, steps, gotchas, or operator tip…"
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                className="h-36 resize-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-slate-600 block mb-2">
                Attachments (Photos / Files)
              </label>
              <label className="flex items-center gap-2 border-2 border-dashed border-slate-300 rounded-xl p-4 cursor-pointer hover:border-blue-400 transition-colors">
                <Paperclip className="w-5 h-5 text-slate-400" />
                <span className="text-sm text-slate-500">Click to attach files</span>
                <input type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx,.txt" className="hidden" onChange={handleFileInput} />
              </label>
              {form.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {form.attachments.map((a, i) => (
                    <div key={i} className="flex items-center gap-1 bg-slate-100 text-slate-700 text-xs px-3 py-1.5 rounded-lg">
                      <FileText className="w-3 h-3" />
                      <span>{a}</span>
                      <button type="button" onClick={() => setForm((f) => ({ ...f, attachments: f.attachments.filter((_, idx) => idx !== i) }))} aria-label="Remove attachment">
                        <X className="w-3 h-3 text-slate-400 hover:text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="md:col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="draft-toggle"
                checked={form.is_draft}
                onChange={(e) => setForm({ ...form, is_draft: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300"
              />
              <label htmlFor="draft-toggle" className="text-sm text-slate-600">
                Save as offline draft (hidden from published search)
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => { setShowForm(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleSave}>{editingId ? "Update Note" : "Publish Note"}</Button>
          </div>
        </Modal>
      )}

      {/* DETAIL MODAL */}
      {viewing && (
        <Modal
          title={viewing.title}
          onClose={() => setViewing(null)}
          maxWidth="max-w-2xl"
        >
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Badge className="bg-slate-100 text-slate-600 border-slate-200">
              {eqLabel(viewing.equipment_id)}
            </Badge>
            {viewing.category && (
              <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">
                <Tag className="w-3 h-3" /> {viewing.category}
              </Badge>
            )}
            {viewing.is_draft === 1 && (
              <Badge className="bg-amber-100 text-amber-700 border-amber-200">Draft</Badge>
            )}
          </div>

          {parseJsonArray(viewing.tags).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {parseJsonArray(viewing.tags).map((t) => (
                <span key={t} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">#{t}</span>
              ))}
            </div>
          )}

          <div className="prose max-w-none text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-xl p-4 border border-slate-100">
            {viewing.body || "No description provided."}
          </div>

          {parseJsonArray(viewing.attachments).length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1">
                <Paperclip className="w-3 h-3" /> Attachments ({parseJsonArray(viewing.attachments).length})
              </p>
              <div className="flex flex-wrap gap-2">
                {parseJsonArray(viewing.attachments).map((a, i) => (
                  <span key={i} className="flex items-center gap-1 bg-slate-100 text-slate-700 text-xs px-3 py-1.5 rounded-lg">
                    <FileText className="w-3 h-3" /> {a}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 text-xs text-slate-400 mt-5">
            {viewing.author && (
              <span className="flex items-center gap-1"><User className="w-3 h-3" /> {viewing.author}</span>
            )}
            {viewing.created_at && (
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(viewing.created_at).toLocaleString()}</span>
            )}
          </div>

          {canEditKnowledge && (
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="danger" onClick={() => setDeleteId(viewing.id)}>
                <Trash2 className="w-4 h-4" /> Delete
              </Button>
              <Button onClick={() => { startEdit(viewing); setViewing(null); }}>
                <Pencil className="w-4 h-4" /> Edit
              </Button>
            </div>
          )}
        </Modal>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        title="Delete knowledge note"
        message="Remove this knowledge note? This cannot be undone."
        confirmLabel="Delete"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) handleDelete(deleteId);
          setDeleteId(null);
        }}
      />
    </div>
  );
}
