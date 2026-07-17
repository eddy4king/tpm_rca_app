import { useState, useEffect, useMemo, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  Button, Card, Input, Select, Textarea, Badge, PageHeader, StatCard, Field,
  TableCard, LoadingState, Banner, Modal, tableHeadClass, thClass, tdClass, trClass,
} from "../components/ui";
import { Boxes, Package, Plus, Search, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

interface InventoryItem {
  id: string;
  part_number: string;
  name: string;
  description: string | null;
  category: string | null;
  unit: string | null;
  qty_on_hand: number;
  reorder_level: number;
  reorder_qty: number;
  unit_cost: number | null;
  location: string | null;
  supplier_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface InventoryTransaction {
  id: string;
  item_id: string;
  txn_type: string;
  qty: number;
  wo_id: string | null;
  user_id: string | null;
  note: string | null;
  created_at: string | null;
}

const TXN_TYPES = [
  { value: "receive", label: "Receive (stock in)" },
  { value: "issue", label: "Issue (stock out)" },
  { value: "return", label: "Return (stock in)" },
  { value: "adjust", label: "Adjust (set count)" },
];

const defaultForm = {
  part_number: "",
  name: "",
  description: "",
  category: "",
  unit: "",
  qty_on_hand: "0",
  reorder_level: "0",
  reorder_qty: "0",
  unit_cost: "",
  location: "",
};

function isLow(item: InventoryItem) {
  return item.qty_on_hand <= item.reorder_level;
}

export default function InventoryPage() {
  const { canEdit } = useAuth();
  const toast = useToast();
  const canManage = canEdit("Engineer");
  const canTransact = canEdit("Technician");

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [lowStock, setLowStock] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);

  const [txnOpen, setTxnOpen] = useState(false);
  const [txnItem, setTxnItem] = useState<InventoryItem | null>(null);
  const [txn, setTxn] = useState({ type: "receive", qty: "", note: "", wo_id: "" });

  const [detailItem, setDetailItem] = useState<InventoryItem | null>(null);
  const [txns, setTxns] = useState<InventoryTransaction[]>([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [it, low] = await Promise.all([
        invoke<InventoryItem[]>("get_items"),
        invoke<InventoryItem[]>("get_low_stock_items"),
      ]);
      setItems(it);
      setLowStock(low);
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const categories = useMemo(
    () => [...new Set(items.map((i) => i.category).filter(Boolean))] as string[],
    [items]
  );

  const filtered = useMemo(() => items.filter((i) => {
    const matchesSearch = !search ||
      `${i.part_number} ${i.name} ${i.location}`.toLowerCase().includes(search.toLowerCase());
    const matchesCat = !categoryFilter || i.category === categoryFilter;
    return matchesSearch && matchesCat;
  }), [items, search, categoryFilter]);

  const stats = useMemo(() => ({
    total: items.length,
    low: lowStock.length,
    value: items.reduce((a, i) => a + (i.qty_on_hand * (i.unit_cost || 0)), 0),
  }), [items, lowStock]);

  function resetForm() {
    setForm(defaultForm);
    setEditingId(null);
  }

  function openEdit(item: InventoryItem) {
    setForm({
      part_number: item.part_number,
      name: item.name,
      description: item.description || "",
      category: item.category || "",
      unit: item.unit || "",
      qty_on_hand: String(item.qty_on_hand),
      reorder_level: String(item.reorder_level),
      reorder_qty: String(item.reorder_qty),
      unit_cost: item.unit_cost != null ? String(item.unit_cost) : "",
      location: item.location || "",
    });
    setEditingId(item.id);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.part_number || !form.name) {
      toast.error("Part number and name are required");
      return;
    }
    try {
      const payload = {
        partNumber: form.part_number,
        name: form.name,
        description: form.description || null,
        category: form.category || null,
        unit: form.unit || null,
        qtyOnHand: Number(form.qty_on_hand) || 0,
        reorderLevel: Number(form.reorder_level) || 0,
        reorderQty: Number(form.reorder_qty) || 0,
        unitCost: form.unit_cost ? Number(form.unit_cost) : null,
        location: form.location || null,
        supplierId: null,
      };
      if (editingId) {
        await invoke("update_item", { payload: { id: editingId, ...payload } });
        toast.success("Item updated");
      } else {
        await invoke("create_item", { payload });
        toast.success("Item created");
      }
      resetForm();
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(`Save failed: ${err}`);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this inventory item?")) return;
    try {
      await invoke("delete_item", { id });
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast.success("Item deleted");
    } catch (err) {
      toast.error(`Delete failed: ${err}`);
    }
  }

  function openTxn(item: InventoryItem) {
    setTxnItem(item);
    setTxn({ type: "receive", qty: "", note: "", wo_id: "" });
    setTxnOpen(true);
  }

  async function handleTxn() {
    if (!txnItem || !txn.qty || Number(txn.qty) <= 0) {
      toast.error("Enter a positive quantity");
      return;
    }
    try {
      await invoke("record_inventory_txn", {
        payload: {
          itemId: txnItem.id,
          txnType: txn.type,
          qty: Number(txn.qty),
          woId: txn.wo_id || null,
          userId: null,
          note: txn.note || null,
        },
      });
      toast.success("Stock updated");
      setTxnOpen(false);
      load();
    } catch (err) {
      toast.error(`Transaction failed: ${err}`);
    }
  }

  async function openDetail(item: InventoryItem) {
    try {
      const t = await invoke<InventoryTransaction[]>("get_item_transactions", { itemId: item.id });
      setTxns(t);
      setDetailItem(item);
    } catch (err) {
      toast.error(`Could not load history: ${err}`);
    }
  }

  if (loading) return <LoadingState label="Loading inventory…" />;
  if (error) return <Banner tone="error">{error}</Banner>;

  return (
    <div className="space-y-6 p-6 h-full overflow-y-auto">
      <PageHeader
        title="Spare Parts & Inventory"
        subtitle="Track stock levels, reorder points and material movements"
        actions={
          canManage ? (
            <Button onClick={() => { resetForm(); setShowForm(true); }}>
              <Plus className="w-4 h-4" /> Add Item
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon={<Boxes className="w-5 h-5" />} tint="slate" label="Total Items" value={<span className="text-slate-900">{stats.total}</span>} />
        <StatCard icon={<Package className="w-5 h-5" />} tint="rose" label="Low Stock" value={<span className="text-rose-600">{stats.low}</span>} />
        <StatCard icon={<Boxes className="w-5 h-5" />} tint="emerald" label="Inventory Value" value={<span className="text-emerald-600">${stats.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>} />
      </div>

      {stats.low > 0 && (
        <Banner tone="error">
          {stats.low} item(s) at or below reorder point — review and replenish.
        </Banner>
      )}

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            <Input placeholder="Search part #, name, location…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">All Categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center text-slate-400">
          <Package className="w-12 h-12 mx-auto text-slate-300 mb-4" />
          <p className="text-lg font-semibold text-slate-400 mb-2">No inventory items</p>
          <p className="text-sm">Add spare parts to start tracking stock.</p>
        </Card>
      ) : (
        <TableCard>
          <table className="w-full">
            <thead className={tableHeadClass}>
              <tr>
                <th className={thClass}>Part #</th>
                <th className={thClass}>Name</th>
                <th className={thClass}>Category</th>
                <th className={thClass}>On Hand</th>
                <th className={thClass}>Reorder At</th>
                <th className={thClass}>Location</th>
                <th className={thClass}>Unit Cost</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <tr key={i.id} className={`${trClass} cursor-pointer`} onClick={() => openDetail(i)}>
                  <td className={`${tdClass} font-mono`}>{i.part_number}</td>
                  <td className={tdClass}>
                    <p className="font-semibold text-slate-800">{i.name}</p>
                    {i.description && <p className="text-xs text-slate-400 truncate max-w-xs">{i.description}</p>}
                  </td>
                  <td className={`${tdClass} text-slate-600`}>{i.category || "—"}</td>
                  <td className={tdClass}>
                    {i.qty_on_hand} <span className="text-slate-400 text-xs">{i.unit || ""}</span>
                  </td>
                  <td className={`${tdClass} text-slate-600`}>{i.reorder_level}</td>
                  <td className={`${tdClass} text-slate-600`}>{i.location || "—"}</td>
                  <td className={`${tdClass} text-slate-600`}>{i.unit_cost != null ? `$${i.unit_cost}` : "—"}</td>
                  <td className={tdClass}>
                    {isLow(i)
                      ? <Badge className="bg-rose-100 text-rose-700 border-rose-200">Low</Badge>
                      : <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">OK</Badge>}
                  </td>
                  <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-2">
                      {canTransact && (
                        <Button size="sm" variant="secondary" onClick={() => openTxn(i)} title="Receive / Issue">
                          <ArrowDownToLine className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {canManage ? (
                        <>
                          <Button size="sm" variant="edit" onClick={() => openEdit(i)}>Edit</Button>
                          <Button size="sm" variant="danger" onClick={() => handleDelete(i.id)}>Delete</Button>
                        </>
                      ) : <span className="text-xs text-slate-400">View only</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      )}

      {showForm && canManage && (
        <Modal title={editingId ? "Edit Item" : "Add Item"} onClose={() => setShowForm(false)} maxWidth="max-w-lg">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Part Number *"><Input value={form.part_number} onChange={(e) => setForm({ ...form, part_number: e.target.value })} /></Field>
            <Field label="Name *"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Category"><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
            <Field label="Unit"><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="ea, m, kg…" /></Field>
            <Field label="Qty On Hand"><Input type="number" value={form.qty_on_hand} onChange={(e) => setForm({ ...form, qty_on_hand: e.target.value })} /></Field>
            <Field label="Reorder Level"><Input type="number" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} /></Field>
            <Field label="Reorder Qty"><Input type="number" value={form.reorder_qty} onChange={(e) => setForm({ ...form, reorder_qty: e.target.value })} /></Field>
            <Field label="Unit Cost"><Input type="number" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} placeholder="0.00" /></Field>
            <Field label="Location" className="col-span-2"><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
            <Field label="Description" className="col-span-2"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          </div>
          <div className="flex justify-end gap-3 mt-2">
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingId ? "Update" : "Create"}</Button>
          </div>
        </Modal>
      )}

      {txnOpen && txnItem && (
        <Modal title={`Stock Movement — ${txnItem.name}`} onClose={() => setTxnOpen(false)} maxWidth="max-w-sm">
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Current on hand: <span className="font-semibold text-slate-800">{txnItem.qty_on_hand} {txnItem.unit || ""}</span>
            </p>
            <Field label="Transaction Type">
              <Select value={txn.type} onChange={(e) => setTxn({ ...txn, type: e.target.value })}>
                {TXN_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
            </Field>
            <Field label="Quantity">
              <Input type="number" value={txn.qty} onChange={(e) => setTxn({ ...txn, qty: e.target.value })} />
            </Field>
            <Field label="Work Order ID (optional)">
              <Input value={txn.wo_id} onChange={(e) => setTxn({ ...txn, wo_id: e.target.value })} placeholder="Link to a work order" />
            </Field>
            <Field label="Note">
              <Textarea value={txn.note} onChange={(e) => setTxn({ ...txn, note: e.target.value })} />
            </Field>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setTxnOpen(false)}>Cancel</Button>
              <Button onClick={handleTxn}><ArrowUpFromLine className="w-4 h-4" /> Apply</Button>
            </div>
          </div>
        </Modal>
      )}

      {detailItem && (
        <Modal title={`History — ${detailItem.name}`} onClose={() => setDetailItem(null)} maxWidth="max-w-lg">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-4 text-sm">
              <span><span className="text-slate-500">Part #:</span> <span className="font-mono">{detailItem.part_number}</span></span>
              <span><span className="text-slate-500">On hand:</span> {detailItem.qty_on_hand} {detailItem.unit || ""}</span>
              <span><span className="text-slate-500">Location:</span> {detailItem.location || "—"}</span>
            </div>
            {txns.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">No movements recorded yet.</p>
            ) : (
              <div className="max-h-72 overflow-y-auto border border-slate-100 rounded-lg divide-y divide-slate-100">
                {txns.map((t) => (
                  <div key={t.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <div>
                      <span className="font-medium capitalize text-slate-800">{t.txn_type}</span>
                      <span className="text-slate-500"> · {t.qty} {detailItem.unit || ""}</span>
                      {t.wo_id && <span className="text-xs text-slate-400"> · WO {t.wo_id.slice(0, 8)}</span>}
                    </div>
                    <span className="text-xs text-slate-400">{t.created_at}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
