import { useState, useEffect, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  NodeDragHandler,
  MiniMap,
  Handle,
  Position,
} from "reactflow";
import {
  Plus,
  ClipboardList,
  AlertTriangle,
  ShieldAlert,
  Network,
  Search,
  Pencil,
  Trash2,
  FileText,
  CheckCircle2,
  Clock3,
  XCircle,
  Filter,
} from "lucide-react";
import "reactflow/dist/style.css";

interface Equipment {
  id: string;
  tag_number: string | null;
  name: string | null;
}

interface RcaInvestigation {
  id: string;
  equipment_id: string;
  title: string | null;
  description: string | null;
  status: string | null;
  created_by: string | null;
  created_at: string | null;
}

interface RcaNode {
  id: string;
  investigation_id: string;
  parent_id: string | null;
  node_type: string | null;
  gate_type: string | null;
  title: string | null;
  description: string | null;
  x_pos: number;
  y_pos: number;
}

const nodeColors: Record<string, string> = {
  TopEvent: "#ef4444",
  IntermediateEvent: "#f59e0b",
  BasicEvent: "#10b981",
  Gate: "#3b82f6",
};

const statusBadge: Record<string, string> = {
  Open: "bg-red-100 text-red-700",
  "In Progress": "bg-amber-100 text-amber-700",
  Closed: "bg-emerald-100 text-emerald-700",
};



function EnterpriseNode({ data }: any) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-lg min-w-[220px] overflow-hidden relative">
      
      {/* TARGET HANDLE (incoming connection) */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-slate-400 border-2 border-white"
      />

      <div
        className="h-1"
        style={{ background: data.color }}
      />

      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {data.nodeType}
          </span>

          {data.gateType && (
            <span className="text-[10px] px-2 py-1 rounded-full bg-slate-100 text-slate-600 font-medium">
              {data.gateType}
            </span>
          )}
        </div>

        <h3 className="font-semibold text-slate-800 text-sm leading-snug">
          {data.title}
        </h3>

        {data.description && (
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            {data.description}
          </p>
        )}
      </div>

      {/* SOURCE HANDLE (outgoing connection) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-blue-500 border-2 border-white"
      />
    </div>
  );
}

const nodeTypes = { enterprise: EnterpriseNode };

function RcaPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [investigations, setInvestigations] = useState<RcaInvestigation[]>([]);
  const [rcaNodes, setRcaNodes] = useState<RcaNode[]>([]);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState("");
  const [selectedInvestigation, setSelectedInvestigation] = useState<RcaInvestigation | null>(null);
  const [selectedNode, setSelectedNode] = useState<RcaNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showInvestigationForm, setShowInvestigationForm] = useState(false);
  const [showNodeForm, setShowNodeForm] = useState(false);
  const [showEditNodeForm, setShowEditNodeForm] = useState(false);
  const [showEditInvestigationForm, setShowEditInvestigationForm] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [editingInvestigationId, setEditingInvestigationId] = useState<string | null>(null);

  const [investigationForm, setInvestigationForm] = useState({
    title: "", description: "", created_by: "", status: "Open",
  });

  const [nodeForm, setNodeForm] = useState({
    parent_id: "", node_type: "TopEvent", gate_type: "AND", title: "", description: "",
  });

  const [editNodeForm, setEditNodeForm] = useState({
    title: "", description: "", node_type: "TopEvent", gate_type: "",
  });

  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState([]);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState([]);

  const filteredInvestigations = useMemo(() =>
    investigations.filter(i => i.title?.toLowerCase().includes(search.toLowerCase())),
    [investigations, search]
  );

  const topEvents = rcaNodes.filter(n => n.node_type === "TopEvent");
  const basicEvents = rcaNodes.filter(n => n.node_type === "BasicEvent");

  const onConnect = useCallback(
    (connection: Connection) => setFlowEdges(eds => addEdge({ ...connection, type: "smoothstep", style: { stroke: "#94a3b8", strokeWidth: 2 } }, eds)),
    [setFlowEdges]
  );

  const onNodeDragStop: NodeDragHandler = useCallback(async (_, node) => {
    try {
      await invoke("update_node_position", { id: node.id, xPos: node.position.x, yPos: node.position.y });
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (selectedInvestigation?.id) loadNodes(selectedInvestigation.id);
    else { setRcaNodes([]); setSelectedNode(null); }
  }, [selectedInvestigation]);

  useEffect(() => {
    const { nodes, edges } = buildFlow(rcaNodes);
    setFlowNodes(nodes);
    setFlowEdges(edges);
  }, [rcaNodes]);

  async function loadData() {
    try {
      setLoading(true);
      const eq = await invoke<Equipment[]>("get_all_equipment");
      setEquipment(eq);
      if (eq.length > 0) {
        setSelectedEquipmentId(eq[0].id);
        const inv = await invoke<RcaInvestigation[]>("get_investigations", { equipmentId: eq[0].id });
        setInvestigations(inv);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadInvestigations(id: string) {
    try {
      const inv = await invoke<RcaInvestigation[]>("get_investigations", { equipmentId: id });
      setInvestigations(inv);
      setSelectedEquipmentId(id);
      setSelectedInvestigation(null);
      setSelectedNode(null);
    } catch (err) {
      setError(String(err));
    }
  }

  async function loadNodes(id: string) {
    try {
      const data = await invoke<RcaNode[]>("get_investigation_nodes", { investigationId: id });
      setRcaNodes(data);
    } catch (err) {
      setError(String(err));
    }
  }

  function buildFlow(nodesData: RcaNode[]) {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    nodesData.forEach((n, index) => {
      nodes.push({
        id: n.id,
        type: "enterprise",
        position: { x: n.x_pos || index * 260, y: n.y_pos || index * 120 },
        data: {
          title: n.title,
          description: n.description,
          nodeType: n.node_type,
          gateType: n.gate_type,
          color: nodeColors[n.node_type || ""] || "#64748b",
        },
      });
      if (n.parent_id) {
        edges.push({
            id: `${n.parent_id}-${n.id}`,
            source: n.parent_id,
            target: n.id,
            type: "smoothstep",
            animated: true,
            style: {
                stroke: "#64748b",
                strokeWidth: 2.5,
            },
        });
      }
    });
    return { nodes, edges };
  }

  function generateSummary(): string {
    if (rcaNodes.length === 0) return "No nodes in fault tree.";
    const top = rcaNodes.filter(n => n.node_type === "TopEvent");
    const basic = rcaNodes.filter(n => n.node_type === "BasicEvent");
    const gates = rcaNodes.filter(n => n.node_type === "Gate");
    const inter = rcaNodes.filter(n => n.node_type === "IntermediateEvent");
    let s = `FAULT TREE ANALYSIS SUMMARY\n`;
    s += `Investigation: ${selectedInvestigation?.title}\n`;
    s += `Status: ${selectedInvestigation?.status}\n`;
    s += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    if (top.length > 0) { s += `TOP EVENT:\n`; top.forEach(n => { s += `  • ${n.title}${n.description ? ` — ${n.description}` : ""}\n`; }); s += `\n`; }
    if (gates.length > 0) { s += `LOGIC GATES:\n`; gates.forEach(n => { s += `  • ${n.gate_type} Gate${n.title ? ` — ${n.title}` : ""}\n`; }); s += `\n`; }
    if (inter.length > 0) { s += `INTERMEDIATE EVENTS:\n`; inter.forEach(n => { s += `  • ${n.title}${n.description ? ` — ${n.description}` : ""}\n`; }); s += `\n`; }
    if (basic.length > 0) { s += `ROOT CAUSES:\n`; basic.forEach(n => { s += `  • ${n.title}${n.description ? ` — ${n.description}` : ""}\n`; }); s += `\n`; }
    s += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    s += `Total Nodes: ${rcaNodes.length} | Root Causes: ${basic.length}`;
    return s;
  }

  async function handleCreateInvestigation() {
    if (!investigationForm.title) return;
    try {
      await invoke("create_investigation", {
        payload: {
          equipmentId: selectedEquipmentId,
          downtimeId: null,
          title: investigationForm.title,
          description: investigationForm.description || null,
          createdBy: investigationForm.created_by || null,
        },
      });
      setShowInvestigationForm(false);
      setInvestigationForm({ title: "", description: "", created_by: "", status: "Open" });
      loadInvestigations(selectedEquipmentId);
    } catch (err) { setError(String(err)); }
  }

  async function handleUpdateInvestigation() {
    if (!editingInvestigationId) return;
    try {
      await invoke("update_investigation", {
        payload: {
          id: editingInvestigationId,
          title: investigationForm.title || null,
          description: investigationForm.description || null,
          status: investigationForm.status || null,
        },
      });
      setShowEditInvestigationForm(false);
      setEditingInvestigationId(null);
      loadInvestigations(selectedEquipmentId);
    } catch (err) { setError(String(err)); }
  }

  async function handleDeleteInvestigation(id: string) {
    if (!confirm("Delete this investigation and all its nodes?")) return;
    try {
      await invoke("delete_investigation", { id });
      loadInvestigations(selectedEquipmentId);
    } catch (err) { setError(String(err)); }
  }

  async function handleAddNode() {
    if (!selectedInvestigation || !nodeForm.title) return;
    try {
      await invoke("add_rca_node", {
        payload: {
          investigationId: selectedInvestigation.id,
          parentId: nodeForm.parent_id || null,
          nodeType: nodeForm.node_type,
          gateType: nodeForm.node_type === "Gate" ? nodeForm.gate_type : null,
          title: nodeForm.title,
          description: nodeForm.description || null,
        },
      });
      setShowNodeForm(false);
      setNodeForm({ parent_id: "", node_type: "TopEvent", gate_type: "AND", title: "", description: "" });
      loadNodes(selectedInvestigation.id);
    } catch (err) { setError(String(err)); }
  }

  async function handleUpdateNode() {
    if (!selectedNode) return;
    try {
      await invoke("update_rca_node", {
        payload: {
          id: selectedNode.id,
          title: editNodeForm.title || null,
          description: editNodeForm.description || null,
          nodeType: editNodeForm.node_type || null,
          gateType: editNodeForm.gate_type || null,
        },
      });
      setShowEditNodeForm(false);
      if (selectedInvestigation) loadNodes(selectedInvestigation.id);
    } catch (err) { setError(String(err)); }
  }

  async function handleDeleteNode(id: string) {
    if (!confirm("Delete this node?")) return;
    try {
      await invoke("delete_rca_node", { id });
      setSelectedNode(null);
      if (selectedInvestigation) loadNodes(selectedInvestigation.id);
    } catch (err) { setError(String(err)); }
  }

  if (loading) return <div className="h-screen flex items-center justify-center text-slate-500">Loading RCA Workspace...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;

  return (
    <div className="flex bg-slate-100 text-slate-800 overflow-hidden" style={{ height: "calc(100vh - 80px)" }}>

      {/* SIDEBAR */}
      <div className="w-80 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-5 border-b border-slate-200">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardList className="w-5 h-5 text-blue-600" />
            <h1 className="font-bold text-lg">RCA Workspace</h1>
          </div>
          <select
            value={selectedEquipmentId}
            onChange={(e) => loadInvestigations(e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm mb-3 bg-white"
          >
            {equipment.map((eq) => (
              <option key={eq.id} value={eq.id}>{eq.tag_number} — {eq.name}</option>
            ))}
          </select>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            <input
              placeholder="Search investigations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-slate-300 rounded-xl pl-10 pr-4 py-2 text-sm"
            />
          </div>
          <button
            onClick={() => setShowInvestigationForm(true)}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-2.5 flex items-center justify-center gap-2 font-medium"
          >
            <Plus className="w-4 h-4" /> New Investigation
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredInvestigations.length === 0 ? (
            <p className="text-slate-400 text-sm text-center mt-6">No investigations found.</p>
          ) : filteredInvestigations.map((inv) => (
            <div
              key={inv.id}
              onClick={() => setSelectedInvestigation(inv)}
              className={`rounded-2xl border p-4 cursor-pointer transition ${selectedInvestigation?.id === inv.id ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="font-semibold text-sm">{inv.title}</div>
                <div className={`text-[10px] px-2 py-1 rounded-full font-medium ${statusBadge[inv.status || ""] || "bg-slate-100 text-slate-600"}`}>
                  {inv.status}
                </div>
              </div>
              <div className="text-xs text-slate-500 line-clamp-2">{inv.description || "No description"}</div>
              <div className="flex items-center justify-between mt-3 text-[11px] text-slate-400">
                <span>{inv.created_by || "Unknown"}</span>
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => {
                      setEditingInvestigationId(inv.id);
                      setInvestigationForm({ title: inv.title || "", description: inv.description || "", created_by: inv.created_by || "", status: inv.status || "Open" });
                      setShowEditInvestigationForm(true);
                    }}
                    className="hover:text-blue-500"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDeleteInvestigation(inv.id)} className="hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-slate-200 text-xs text-slate-400 space-y-1">
          <p className="font-semibold text-slate-500 mb-2">FTA Node Types:</p>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm inline-block bg-red-500"></span>Top Event — the failure</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm inline-block bg-amber-500"></span>Intermediate — contributing cause</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm inline-block bg-emerald-500"></span>Basic Event — root cause</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full inline-block bg-blue-500"></span>Gate — AND/OR logic</div>
        </div>
      </div>

      {/* MAIN */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* HEADER */}
        <div className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">{selectedInvestigation?.title || "Fault Tree Analysis"}</h2>
              <p className="text-sm text-slate-500 mt-1">Enterprise Root Cause Analysis Workspace</p>
            </div>
            <div className="flex gap-3">
              {selectedInvestigation && (
                <button
                  onClick={() => setShowSummary(true)}
                  className="border border-slate-300 bg-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-50 flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" /> Summary
                </button>
              )}
              <button
                onClick={() => setShowNodeForm(true)}
                disabled={!selectedInvestigation}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Add Node
              </button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 mt-5">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <div className="flex justify-between items-center">
                <div><p className="text-xs text-slate-500">Total Nodes</p><h3 className="text-2xl font-bold mt-1">{rcaNodes.length}</h3></div>
                <Network className="w-8 h-8 text-blue-500" />
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <div className="flex justify-between items-center">
                <div><p className="text-xs text-slate-500">Root Causes</p><h3 className="text-2xl font-bold mt-1">{basicEvents.length}</h3></div>
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <div className="flex justify-between items-center">
                <div><p className="text-xs text-slate-500">Top Events</p><h3 className="text-2xl font-bold mt-1">{topEvents.length}</h3></div>
                <ShieldAlert className="w-8 h-8 text-amber-500" />
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <div className="flex justify-between items-center">
                <div><p className="text-xs text-slate-500">Status</p><h3 className="text-lg font-bold mt-1">{selectedInvestigation?.status || "—"}</h3></div>
                {selectedInvestigation?.status === "Closed" ? <CheckCircle2 className="w-8 h-8 text-emerald-500" /> :
                  selectedInvestigation?.status === "In Progress" ? <Clock3 className="w-8 h-8 text-amber-500" /> :
                  <XCircle className="w-8 h-8 text-red-500" />}
              </div>
            </div>
          </div>
        </div>

        {/* FLOW + RIGHT PANEL */}
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 bg-slate-50">
            {!selectedInvestigation ? (
              <div className="flex items-center justify-center h-full text-center p-8">
                <div>
                  <Network className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h2 className="text-xl font-bold text-slate-400 mb-2">Select an Investigation</h2>
                  <p className="text-slate-400 text-sm">Choose an investigation from the sidebar to open the fault tree canvas.</p>
                </div>
              </div>
            ) : rcaNodes.length === 0 ? (
              <div className="flex items-center justify-center h-full text-center p-8">
                <div>
                  <p className="text-slate-400 mb-2">Fault tree is empty.</p>
                  <p className="text-sm text-slate-500">Click "+ Add Node" to start. Begin with a Top Event.</p>
                </div>
              </div>
            ) : (
              <ReactFlow
                nodes={flowNodes}
                edges={flowEdges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeDragStop={onNodeDragStop}
                onNodeClick={(_, node) => {
                    const found = rcaNodes.find(n => n.id === node.id);
                    if (found) setSelectedNode(found);
                }}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                connectionLineStyle={{
                    stroke: "#3b82f6",
                    strokeWidth: 3,
                }}
                defaultEdgeOptions={{
                    type: "smoothstep",
                    animated: true,
                }}
                >
                <Controls />
                <MiniMap
                    pannable
                    zoomable
                    className="bg-white border border-slate-200"
                />
                <Background color="#cbd5e1" gap={18} />
              </ReactFlow>
            )}
          </div>

          {/* RIGHT PANEL */}
          <div className="w-80 bg-white border-l border-slate-200 overflow-y-auto">
            <div className="p-5 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">Node Properties</h3>
                <Filter className="w-4 h-4 text-slate-400" />
              </div>
            </div>

            {selectedNode ? (
              <div className="p-5 space-y-5">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Node Title</p>
                  <h2 className="font-semibold text-lg">{selectedNode.title}</h2>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Node Type</p>
                  <div className="inline-flex px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-sm font-medium">
                    {selectedNode.node_type}
                  </div>
                </div>
                {selectedNode.gate_type && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Gate Type</p>
                    <div className="inline-flex px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-medium">
                      {selectedNode.gate_type}
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Description</p>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-600 leading-relaxed">
                    {selectedNode.description || "No description available"}
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Parent Node</p>
                  <div className="text-sm text-slate-600">
                    {selectedNode.parent_id
                      ? rcaNodes.find(n => n.id === selectedNode.parent_id)?.title || "Unknown"
                      : "None (Top Level)"}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setEditNodeForm({
                      title: selectedNode.title || "",
                      description: selectedNode.description || "",
                      node_type: selectedNode.node_type || "TopEvent",
                      gate_type: selectedNode.gate_type || "",
                    });
                    setShowEditNodeForm(true);
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-medium"
                >
                  Edit Node
                </button>
                <button
                  onClick={() => handleDeleteNode(selectedNode.id)}
                  className="w-full border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 py-3 rounded-xl font-medium"
                >
                  Delete Node
                </button>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-center p-8">
                <div>
                  <Network className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">Select a node to view properties and actions.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CREATE INVESTIGATION MODAL */}
      {showInvestigationForm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6">
            <h2 className="text-xl font-bold mb-5">Create Investigation</h2>
            <div className="space-y-4">
              <input placeholder="Investigation Title" value={investigationForm.title} onChange={e => setInvestigationForm({ ...investigationForm, title: e.target.value })} className="w-full border border-slate-300 rounded-xl px-4 py-3" />
              <textarea placeholder="Description" value={investigationForm.description} onChange={e => setInvestigationForm({ ...investigationForm, description: e.target.value })} className="w-full border border-slate-300 rounded-xl px-4 py-3 h-28 resize-none" />
              <input placeholder="Created By" value={investigationForm.created_by} onChange={e => setInvestigationForm({ ...investigationForm, created_by: e.target.value })} className="w-full border border-slate-300 rounded-xl px-4 py-3" />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowInvestigationForm(false)} className="px-5 py-2 rounded-xl border border-slate-300">Cancel</button>
              <button onClick={handleCreateInvestigation} className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT INVESTIGATION MODAL */}
      {showEditInvestigationForm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6">
            <h2 className="text-xl font-bold mb-5">Edit Investigation</h2>
            <div className="space-y-4">
              <input placeholder="Title" value={investigationForm.title} onChange={e => setInvestigationForm({ ...investigationForm, title: e.target.value })} className="w-full border border-slate-300 rounded-xl px-4 py-3" />
              <textarea placeholder="Description" value={investigationForm.description} onChange={e => setInvestigationForm({ ...investigationForm, description: e.target.value })} className="w-full border border-slate-300 rounded-xl px-4 py-3 h-24 resize-none" />
              <input placeholder="Created By" value={investigationForm.created_by} onChange={e => setInvestigationForm({ ...investigationForm, created_by: e.target.value })} className="w-full border border-slate-300 rounded-xl px-4 py-3" />
              <select value={investigationForm.status} onChange={e => setInvestigationForm({ ...investigationForm, status: e.target.value })} className="w-full border border-slate-300 rounded-xl px-4 py-3">
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowEditInvestigationForm(false)} className="px-5 py-2 rounded-xl border border-slate-300">Cancel</button>
              <button onClick={handleUpdateInvestigation} className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl">Update</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD NODE MODAL */}
      {showNodeForm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6">
            <h2 className="text-xl font-bold mb-5">Add RCA Node</h2>
            <div className="space-y-4">
              <input placeholder="Node Title" value={nodeForm.title} onChange={e => setNodeForm({ ...nodeForm, title: e.target.value })} className="w-full border border-slate-300 rounded-xl px-4 py-3" />
              <select value={nodeForm.node_type} onChange={e => setNodeForm({ ...nodeForm, node_type: e.target.value })} className="w-full border border-slate-300 rounded-xl px-4 py-3">
                <option value="TopEvent">🔴 Top Event — the failure being investigated</option>
                <option value="IntermediateEvent">🟡 Intermediate Event — a contributing cause</option>
                <option value="BasicEvent">🟢 Basic Event — a root cause</option>
                <option value="Gate">🔵 Gate — AND/OR logic connector</option>
              </select>
              {nodeForm.node_type === "Gate" && (
                <select value={nodeForm.gate_type} onChange={e => setNodeForm({ ...nodeForm, gate_type: e.target.value })} className="w-full border border-slate-300 rounded-xl px-4 py-3">
                  <option value="AND">AND Gate — all causes must occur</option>
                  <option value="OR">OR Gate — any cause can trigger</option>
                </select>
              )}
              <select value={nodeForm.parent_id} onChange={e => setNodeForm({ ...nodeForm, parent_id: e.target.value })} className="w-full border border-slate-300 rounded-xl px-4 py-3">
                <option value="">No Parent (Top Level)</option>
                {rcaNodes.map(n => (
                  <option key={n.id} value={n.id}>{n.node_type === "Gate" ? `[${n.gate_type}]` : `[${n.node_type}]`} {n.title}</option>
                ))}
              </select>
              <textarea placeholder="Description (optional)" value={nodeForm.description} onChange={e => setNodeForm({ ...nodeForm, description: e.target.value })} className="w-full border border-slate-300 rounded-xl px-4 py-3 h-24 resize-none" />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowNodeForm(false)} className="px-5 py-2 rounded-xl border border-slate-300">Cancel</button>
              <button onClick={handleAddNode} className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-xl">Add Node</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT NODE MODAL */}
      {showEditNodeForm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6">
            <h2 className="text-xl font-bold mb-5">Edit Node</h2>
            <div className="space-y-4">
              <input placeholder="Node Title" value={editNodeForm.title} onChange={e => setEditNodeForm({ ...editNodeForm, title: e.target.value })} className="w-full border border-slate-300 rounded-xl px-4 py-3" />
              <select value={editNodeForm.node_type} onChange={e => setEditNodeForm({ ...editNodeForm, node_type: e.target.value })} className="w-full border border-slate-300 rounded-xl px-4 py-3">
                <option value="TopEvent">🔴 Top Event</option>
                <option value="IntermediateEvent">🟡 Intermediate Event</option>
                <option value="BasicEvent">🟢 Basic Event</option>
                <option value="Gate">🔵 Gate</option>
              </select>
              {editNodeForm.node_type === "Gate" && (
                <select value={editNodeForm.gate_type} onChange={e => setEditNodeForm({ ...editNodeForm, gate_type: e.target.value })} className="w-full border border-slate-300 rounded-xl px-4 py-3">
                  <option value="AND">AND Gate</option>
                  <option value="OR">OR Gate</option>
                </select>
              )}
              <textarea placeholder="Description (optional)" value={editNodeForm.description} onChange={e => setEditNodeForm({ ...editNodeForm, description: e.target.value })} className="w-full border border-slate-300 rounded-xl px-4 py-3 h-24 resize-none" />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowEditNodeForm(false)} className="px-5 py-2 rounded-xl border border-slate-300">Cancel</button>
              <button onClick={handleUpdateNode} className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl">Update Node</button>
            </div>
          </div>
        </div>
      )}

      {/* SUMMARY MODAL */}
      {showSummary && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">FTA Summary Report</h3>
              <button onClick={() => setShowSummary(false)} className="text-slate-400 hover:text-slate-700 text-xl">✕</button>
            </div>
            <pre className="bg-slate-50 rounded-xl p-4 text-sm font-mono whitespace-pre-wrap overflow-auto max-h-96 text-slate-700">
              {generateSummary()}
            </pre>
            <button
              onClick={() => navigator.clipboard.writeText(generateSummary())}
              className="mt-4 bg-slate-700 text-white px-4 py-2 rounded-xl hover:bg-slate-600 text-sm"
            >
              Copy to Clipboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default RcaPage;