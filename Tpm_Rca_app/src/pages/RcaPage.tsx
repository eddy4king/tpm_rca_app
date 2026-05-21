import { useState, useEffect, useCallback } from "react";
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
} from "reactflow";
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
  IntermediateEvent: "#eab308",
  BasicEvent: "#22c55e",
  Gate: "#3b82f6",
};

const statusColors: Record<string, string> = {
  Open: "bg-red-500",
  "In Progress": "bg-yellow-500",
  Closed: "bg-green-500",
};

function RcaPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [investigations, setInvestigations] = useState<RcaInvestigation[]>([]);
  const [rcaNodes, setRcaNodes] = useState<RcaNode[]>([]);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState("");
  const [selectedInvestigation, setSelectedInvestigation] = useState<RcaInvestigation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInvestigationForm, setShowInvestigationForm] = useState(false);
  const [showNodeForm, setShowNodeForm] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [editingInvestigationId, setEditingInvestigationId] = useState<string | null>(null);
  const [editingNode, setEditingNode] = useState<RcaNode | null>(null);

  const [investigationForm, setInvestigationForm] = useState({
    title: "",
    description: "",
    created_by: "",
    status: "Open",
  });

  const [nodeForm, setNodeForm] = useState({
    parent_id: "",
    node_type: "TopEvent",
    gate_type: "AND",
    title: "",
    description: "",
  });

  const [editNodeForm, setEditNodeForm] = useState({
    title: "",
    description: "",
    node_type: "TopEvent",
    gate_type: "",
  });

  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState([]);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState([]);

  const onConnect = useCallback(
    (connection: Connection) => setFlowEdges((eds) => addEdge({ ...connection, type: "smoothstep", style: { stroke: "#94a3b8", strokeWidth: 2 } }, eds)),
    [setFlowEdges]
  );

  const onNodeDragStop: NodeDragHandler = useCallback(async (_, node) => {
    try {
      await invoke("update_node_position", {
        id: node.id,
        xPos: node.position.x,
        yPos: node.position.y,
      });
    } catch (err) {
      console.error("Failed to update position:", err);
    }
  }, []);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (selectedInvestigation?.id) {
      loadNodes(selectedInvestigation.id);
    } else {
      setRcaNodes([]);
    }
  }, [selectedInvestigation]);

  useEffect(() => {
    if (rcaNodes.length === 0) {
      setFlowNodes([]);
      setFlowEdges([]);
      return;
    }
    const { nodes, edges } = buildFlowNodes(rcaNodes);
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
        const data = await invoke<RcaInvestigation[]>("get_investigations", { equipmentId: eq[0].id });
        setInvestigations(data);
      }
      setLoading(false);
    } catch (err) {
      setError(String(err));
      setLoading(false);
    }
  }

  async function loadInvestigations(equipment_id: string) {
    try {
      const data = await invoke<RcaInvestigation[]>("get_investigations", { equipmentId: equipment_id });
      setInvestigations(data);
      setSelectedEquipmentId(equipment_id);
      setSelectedInvestigation(null);
    } catch (err) {
      setError(String(err));
    }
  }

  async function loadNodes(investigation_id: string) {
    try {
      const data = await invoke<RcaNode[]>("get_investigation_nodes", { investigationId: investigation_id });
      setRcaNodes(data);
    } catch (err) {
      setError(String(err));
    }
  }

  function buildFlowNodes(nodesData: RcaNode[]): { nodes: Node[]; edges: Edge[] } {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    nodesData.forEach((n) => {
      const isGate = n.node_type === "Gate";
      const color = nodeColors[n.node_type || ""] || "#64748b";

      nodes.push({
        id: n.id,
        position: { x: n.x_pos || 400, y: n.y_pos || 100 },
        data: {
          label: (
            <div style={{ padding: "6px 8px", textAlign: "center" }}>
              <div style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", opacity: 0.8, letterSpacing: "0.05em", marginBottom: "3px" }}>
                {n.node_type}{n.gate_type ? ` • ${n.gate_type}` : ""}
              </div>
              <div style={{ fontSize: "12px", fontWeight: 600, lineHeight: 1.3, whiteSpace: "normal", wordBreak: "break-word" }}>
                {n.title}
              </div>
              {n.description && (
                <div style={{ fontSize: "10px", opacity: 0.75, marginTop: "3px", lineHeight: 1.2 }}>
                  {n.description}
                </div>
              )}
            </div>
          ),
        },
        style: {
          background: color,
          color: "white",
          border: "2px solid rgba(255,255,255,0.25)",
          borderRadius: isGate ? "50%" : "10px",
          width: isGate ? 80 : 200,
          minHeight: isGate ? 80 : 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        },
      });

      if (n.parent_id) {
        edges.push({
          id: `e-${n.parent_id}-${n.id}`,
          source: n.parent_id,
          target: n.id,
          type: "smoothstep",
          style: { stroke: "#94a3b8", strokeWidth: 2 },
        });
      }
    });

    return { nodes, edges };
  }

  function generateSummary(): string {
    if (rcaNodes.length === 0) return "No nodes in fault tree.";

    const topEvents = rcaNodes.filter(n => n.node_type === "TopEvent");
    const basicEvents = rcaNodes.filter(n => n.node_type === "BasicEvent");
    const gates = rcaNodes.filter(n => n.node_type === "Gate");
    const intermediate = rcaNodes.filter(n => n.node_type === "IntermediateEvent");

    let summary = `FAULT TREE ANALYSIS SUMMARY\n`;
    summary += `Investigation: ${selectedInvestigation?.title}\n`;
    summary += `Status: ${selectedInvestigation?.status}\n`;
    summary += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (topEvents.length > 0) {
      summary += `TOP EVENT (Failure Being Investigated):\n`;
      topEvents.forEach(n => {
        summary += `  • ${n.title}${n.description ? ` — ${n.description}` : ""}\n`;
      });
      summary += `\n`;
    }

    if (gates.length > 0) {
      summary += `LOGIC GATES:\n`;
      gates.forEach(n => {
        summary += `  • ${n.gate_type} Gate${n.title ? ` — ${n.title}` : ""}\n`;
      });
      summary += `\n`;
    }

    if (intermediate.length > 0) {
      summary += `INTERMEDIATE EVENTS (Contributing Causes):\n`;
      intermediate.forEach(n => {
        summary += `  • ${n.title}${n.description ? ` — ${n.description}` : ""}\n`;
      });
      summary += `\n`;
    }

    if (basicEvents.length > 0) {
      summary += `ROOT CAUSES (Basic Events):\n`;
      basicEvents.forEach(n => {
        summary += `  • ${n.title}${n.description ? ` — ${n.description}` : ""}\n`;
      });
      summary += `\n`;
    }

    summary += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    summary += `Total Nodes: ${rcaNodes.length} | Root Causes Identified: ${basicEvents.length}`;

    return summary;
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
      setEditingInvestigationId(null);
      loadInvestigations(selectedEquipmentId);
    } catch (err) {
      setError(String(err));
    }
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
      setShowInvestigationForm(false);
      setInvestigationForm({ title: "", description: "", created_by: "", status: "Open" });
      setEditingInvestigationId(null);
      loadInvestigations(selectedEquipmentId);
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleDeleteInvestigation(id: string) {
    try {
      await invoke("delete_investigation", { id });
      loadInvestigations(selectedEquipmentId);
    } catch (err) {
      setError(String(err));
    }
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
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleUpdateNode() {
    if (!editingNode) return;
    try {
      await invoke("update_rca_node", {
        payload: {
          id: editingNode.id,
          title: editNodeForm.title || null,
          description: editNodeForm.description || null,
          nodeType: editNodeForm.node_type || null,
          gateType: editNodeForm.gate_type || null,
        },
      });
      setEditingNode(null);
      if (selectedInvestigation) loadNodes(selectedInvestigation.id);
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleDeleteNode(id: string) {
    if (!selectedInvestigation) return;
    try {
      await invoke("delete_rca_node", { id });
      loadNodes(selectedInvestigation.id);
    } catch (err) {
      setError(String(err));
    }
  }

  function openEditInvestigation(inv: RcaInvestigation) {
    setEditingInvestigationId(inv.id);
    setInvestigationForm({
      title: inv.title || "",
      description: inv.description || "",
      created_by: inv.created_by || "",
      status: inv.status || "Open",
    });
    setShowInvestigationForm(true);
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Loading RCA Module...</div>;
  if (error) return <div className="p-8 text-red-500">Error: {error}</div>;

  return (
    <div className="flex bg-slate-950 text-white" style={{ height: "calc(100vh - 80px)" }}>

      {/* LEFT SIDEBAR */}
      <div className="w-72 border-r border-slate-700 bg-slate-900 flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <h2 className="text-lg font-bold mb-3">RCA Investigations</h2>
          <select
            className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2 text-sm mb-3"
            value={selectedEquipmentId}
            onChange={(e) => loadInvestigations(e.target.value)}
          >
            <option value="">Select Equipment</option>
            {equipment.map((eq) => (
              <option key={eq.id} value={eq.id}>{eq.tag_number} — {eq.name}</option>
            ))}
          </select>
          <button
            onClick={() => { setShowInvestigationForm(true); setEditingInvestigationId(null); setInvestigationForm({ title: "", description: "", created_by: "", status: "Open" }); }}
            className="w-full bg-emerald-600 hover:bg-emerald-500 py-2 rounded-lg text-sm font-medium"
          >
            + New Investigation
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {investigations.length === 0 ? (
            <p className="text-slate-500 text-sm text-center mt-4">No investigations yet.</p>
          ) : (
            investigations.map((inv) => (
              <div
                key={inv.id}
                onClick={() => setSelectedInvestigation(inv)}
                className={`p-3 rounded-lg cursor-pointer transition-all ${selectedInvestigation?.id === inv.id ? "bg-slate-700 ring-1 ring-emerald-500" : "hover:bg-slate-800"}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{inv.title}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`w-2 h-2 rounded-full inline-block ${statusColors[inv.status || ""] || "bg-gray-500"}`}></span>
                      <span className="text-xs text-slate-400">{inv.status}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => openEditInvestigation(inv)} className="text-slate-400 hover:text-blue-400 p-1 text-xs">✏️</button>
                    <button onClick={() => handleDeleteInvestigation(inv.id)} className="text-slate-400 hover:text-red-400 p-1 text-xs">🗑️</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-3 border-t border-slate-700 text-xs text-slate-400 space-y-1">
          <p className="font-semibold text-slate-300 mb-2">FTA Node Types:</p>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm inline-block bg-red-500"></span>Top Event — the failure</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm inline-block bg-yellow-500"></span>Intermediate — contributing cause</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm inline-block bg-green-500"></span>Basic Event — root cause</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full inline-block bg-blue-500"></span>Gate — AND/OR logic</div>
        </div>
      </div>

      {/* MAIN CANVAS */}
      <div className="flex-1 flex flex-col">
        {selectedInvestigation ? (
          <>
            <div className="px-4 py-3 border-b border-slate-700 bg-slate-900 flex items-center justify-between">
              <div>
                <h3 className="font-bold">{selectedInvestigation.title}</h3>
                {selectedInvestigation.description && (
                  <p className="text-xs text-slate-400">{selectedInvestigation.description}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowSummary(true)} className="bg-purple-600 hover:bg-purple-500 px-3 py-1 rounded text-sm">
                  📋 Summary
                </button>
                <button onClick={() => setShowNodeForm(true)} className="bg-emerald-600 hover:bg-emerald-500 px-3 py-2 rounded-lg text-sm font-medium">
                  + Add Node
                </button>
              </div>
            </div>

            <div className="flex-1">
              {rcaNodes.length === 0 ? (
                <div className="flex items-center justify-center h-full text-center">
                  <div>
                    <p className="text-slate-400 mb-2">Fault tree is empty.</p>
                    <p className="text-sm text-slate-500">Click "+ Add Node" to start. Begin with a Top Event.</p>
                  </div>
                </div>
              ) : (
                <ReactFlow
                  nodes={flowNodes}
                  edges={flowEdges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  onNodeDragStop={onNodeDragStop}
                  fitView
                >
                  <Controls />
                  <Background color="#334155" gap={20} size={1} />
                </ReactFlow>
              )}
            </div>

            {rcaNodes.length > 0 && (
              <div className="border-t border-slate-700 bg-slate-900 p-3 max-h-44 overflow-y-auto">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Nodes ({rcaNodes.length})</p>
                <div className="flex flex-wrap gap-2">
                  {rcaNodes.map((n) => (
                    <div key={n.id} className="flex items-center gap-1 bg-slate-800 rounded px-2 py-1 text-xs">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ background: nodeColors[n.node_type || ""] || "#64748b" }}></span>
                      <span>{n.title}</span>
                      {n.gate_type && <span className="text-slate-400">({n.gate_type})</span>}
                      <div className="flex gap-1 ml-1">
                        <button
                          onClick={() => {
                            setEditingNode(n);
                            setEditNodeForm({
                              title: n.title || "",
                              description: n.description || "",
                              node_type: n.node_type || "TopEvent",
                              gate_type: n.gate_type || "",
                            });
                          }}
                          className="text-slate-400 hover:text-blue-400"
                        >✏️</button>
                        <button onClick={() => handleDeleteNode(n.id)} className="text-slate-500 hover:text-red-400">×</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center p-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-300 mb-3">Fault Tree Analysis</h2>
              <p className="text-slate-500 max-w-sm">Select an investigation from the sidebar to open the fault tree canvas, or create a new investigation.</p>
            </div>
          </div>
        )}
      </div>

      {/* INVESTIGATION FORM MODAL */}
      {showInvestigationForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold mb-4">{editingInvestigationId ? "Edit Investigation" : "New Investigation"}</h3>
            <input
              className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 mb-3 text-sm"
              placeholder="Investigation Title"
              value={investigationForm.title}
              onChange={(e) => setInvestigationForm({ ...investigationForm, title: e.target.value })}
            />
            <textarea
              className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 mb-3 text-sm h-20 resize-none"
              placeholder="Description (optional)"
              value={investigationForm.description}
              onChange={(e) => setInvestigationForm({ ...investigationForm, description: e.target.value })}
            />
            <input
              className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 mb-3 text-sm"
              placeholder="Created By (optional)"
              value={investigationForm.created_by}
              onChange={(e) => setInvestigationForm({ ...investigationForm, created_by: e.target.value })}
            />
            {editingInvestigationId && (
              <select
                className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 mb-3 text-sm"
                value={investigationForm.status}
                onChange={(e) => setInvestigationForm({ ...investigationForm, status: e.target.value })}
              >
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Closed">Closed</option>
              </select>
            )}
            <div className="flex gap-3">
              <button onClick={() => { setShowInvestigationForm(false); setEditingInvestigationId(null); }} className="flex-1 py-2 rounded border border-slate-600 text-sm hover:bg-slate-800">
                Cancel
              </button>
              <button
                onClick={editingInvestigationId ? handleUpdateInvestigation : handleCreateInvestigation}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-2 rounded text-sm font-medium"
              >
                {editingInvestigationId ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NODE FORM MODAL */}
      {showNodeForm && selectedInvestigation && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold mb-4">Add Node to Fault Tree</h3>
            <input
              className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 mb-3 text-sm"
              placeholder="Node Title"
              value={nodeForm.title}
              onChange={(e) => setNodeForm({ ...nodeForm, title: e.target.value })}
            />
            <select
              className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 mb-3 text-sm"
              value={nodeForm.node_type}
              onChange={(e) => setNodeForm({ ...nodeForm, node_type: e.target.value })}
            >
              <option value="TopEvent">🔴 Top Event — the failure being investigated</option>
              <option value="IntermediateEvent">🟡 Intermediate Event — a contributing cause</option>
              <option value="BasicEvent">🟢 Basic Event — a root cause</option>
              <option value="Gate">🔵 Gate — AND/OR logic connector</option>
            </select>
            {nodeForm.node_type === "Gate" && (
              <select
                className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 mb-3 text-sm"
                value={nodeForm.gate_type}
                onChange={(e) => setNodeForm({ ...nodeForm, gate_type: e.target.value })}
              >
                <option value="AND">AND Gate — all causes must occur together</option>
                <option value="OR">OR Gate — any single cause can trigger output</option>
              </select>
            )}
            <select
              className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 mb-3 text-sm"
              value={nodeForm.parent_id}
              onChange={(e) => setNodeForm({ ...nodeForm, parent_id: e.target.value })}
            >
              <option value="">No Parent (Top Level)</option>
              {rcaNodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.node_type === "Gate" ? `[${n.gate_type} Gate]` : `[${n.node_type}]`} {n.title}
                </option>
              ))}
            </select>
            <textarea
              className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 mb-4 text-sm h-16 resize-none"
              placeholder="Description (optional)"
              value={nodeForm.description}
              onChange={(e) => setNodeForm({ ...nodeForm, description: e.target.value })}
            />
            <div className="flex gap-3">
              <button onClick={() => setShowNodeForm(false)} className="flex-1 py-2 rounded border border-slate-600 text-sm hover:bg-slate-800">
                Cancel
              </button>
              <button onClick={handleAddNode} className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-2 rounded text-sm font-medium">
                Add Node
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT NODE MODAL */}
      {editingNode && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold mb-4">Edit Node</h3>
            <input
              className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 mb-3 text-sm"
              placeholder="Node Title"
              value={editNodeForm.title}
              onChange={(e) => setEditNodeForm({ ...editNodeForm, title: e.target.value })}
            />
            <select
              className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 mb-3 text-sm"
              value={editNodeForm.node_type}
              onChange={(e) => setEditNodeForm({ ...editNodeForm, node_type: e.target.value })}
            >
              <option value="TopEvent">🔴 Top Event</option>
              <option value="IntermediateEvent">🟡 Intermediate Event</option>
              <option value="BasicEvent">🟢 Basic Event</option>
              <option value="Gate">🔵 Gate</option>
            </select>
            {editNodeForm.node_type === "Gate" && (
              <select
                className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 mb-3 text-sm"
                value={editNodeForm.gate_type}
                onChange={(e) => setEditNodeForm({ ...editNodeForm, gate_type: e.target.value })}
              >
                <option value="AND">AND Gate</option>
                <option value="OR">OR Gate</option>
              </select>
            )}
            <textarea
              className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 mb-4 text-sm h-20 resize-none"
              placeholder="Description (optional)"
              value={editNodeForm.description}
              onChange={(e) => setEditNodeForm({ ...editNodeForm, description: e.target.value })}
            />
            <div className="flex gap-3">
              <button onClick={() => setEditingNode(null)} className="flex-1 py-2 rounded border border-slate-600 text-sm hover:bg-slate-800">
                Cancel
              </button>
              <button onClick={handleUpdateNode} className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-2 rounded text-sm font-medium">
                Update Node
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUMMARY MODAL */}
      {showSummary && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-full max-w-2xl shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">FTA Summary Report</h3>
              <button onClick={() => setShowSummary(false)} className="text-gray-500 hover:text-gray-700 text-xl">✕</button>
            </div>
            <pre className="bg-gray-50 rounded p-4 text-sm font-mono whitespace-pre-wrap overflow-auto max-h-96 text-gray-800">
              {generateSummary()}
            </pre>
            <button
              onClick={() => navigator.clipboard.writeText(generateSummary())}
              className="mt-4 bg-slate-700 text-white px-4 py-2 rounded hover:bg-slate-600 text-sm"
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