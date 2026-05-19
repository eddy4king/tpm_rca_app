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
  MiniMap,
  NodeDragHandler,
  MarkerType,
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
  TopEvent: "#dc2626",
  IntermediateEvent: "#d97706",
  BasicEvent: "#16a34a",
  Gate: "#2563eb",
};

const statusBadge: Record<string, string> = {
  Open: "bg-red-500/20 text-red-300 border border-red-500/30",
  "In Progress": "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30",
  Closed: "bg-green-500/20 text-green-300 border border-green-500/30",
};

function RcaPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [investigations, setInvestigations] = useState<RcaInvestigation[]>([]);
  const [rcaNodes, setRcaNodes] = useState<RcaNode[]>([]);

  const [selectedEquipmentId, setSelectedEquipmentId] = useState("");
  const [selectedInvestigation, setSelectedInvestigation] =
    useState<RcaInvestigation | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showInvestigationForm, setShowInvestigationForm] = useState(false);
  const [showNodeForm, setShowNodeForm] = useState(false);

  const [editingInvestigationId, setEditingInvestigationId] = useState<
    string | null
  >(null);

  const [search, setSearch] = useState("");

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

  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState([]);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState([]);

  const filteredInvestigations = useMemo(() => {
    return investigations.filter((i) =>
      `${i.title} ${i.description}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [investigations, search]);

  const stats = useMemo(() => {
    return {
      totalInvestigations: investigations.length,
      totalNodes: rcaNodes.length,
      open:
        investigations.filter((i) => i.status === "Open").length || 0,
      closed:
        investigations.filter((i) => i.status === "Closed").length || 0,
    };
  }, [investigations, rcaNodes]);

  const onConnect = useCallback(
    (connection: Connection) =>
      setFlowEdges((eds) =>
        addEdge(
          {
            ...connection,
            type: "smoothstep",
            animated: true,
            markerEnd: {
              type: MarkerType.ArrowClosed,
            },
            style: {
              stroke: "#94a3b8",
              strokeWidth: 2,
            },
          },
          eds
        )
      ),
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
      console.error(err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedInvestigation?.id) {
      loadNodes(selectedInvestigation.id);
    } else {
      setRcaNodes([]);
    }
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

        const investigationsData = await invoke<RcaInvestigation[]>(
          "get_investigations",
          {
            equipmentId: eq[0].id,
          }
        );

        setInvestigations(investigationsData);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadInvestigations(equipmentId: string) {
    try {
      const data = await invoke<RcaInvestigation[]>("get_investigations", {
        equipmentId,
      });

      setInvestigations(data);
      setSelectedEquipmentId(equipmentId);
      setSelectedInvestigation(null);
    } catch (err) {
      setError(String(err));
    }
  }

  async function loadNodes(investigationId: string) {
    try {
      const data = await invoke<RcaNode[]>("get_investigation_nodes", {
        investigationId,
      });

      setRcaNodes(data);
    } catch (err) {
      setError(String(err));
    }
  }

  function buildFlow(nodesData: RcaNode[]): {
    nodes: Node[];
    edges: Edge[];
  } {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    nodesData.forEach((n) => {
      const isGate = n.node_type === "Gate";

      nodes.push({
        id: n.id,
        position: {
          x: n.x_pos || 300,
          y: n.y_pos || 100,
        },
        data: {
          nodeType: n.node_type,
          label: (
            <div className="text-center px-2 py-1">
              <div className="text-[10px] uppercase tracking-wider opacity-70 font-bold mb-1">
                {n.node_type}
                {n.gate_type ? ` • ${n.gate_type}` : ""}
              </div>

              <div className="font-semibold text-sm break-words">
                {n.title}
              </div>

              {n.description && (
                <div className="text-[11px] opacity-80 mt-1 break-words">
                  {n.description}
                </div>
              )}
            </div>
          ),
        },

        style: {
          background: nodeColors[n.node_type || ""] || "#475569",
          color: "white",
          borderRadius: isGate ? "50%" : "14px",
          width: isGate ? 90 : 220,
          minHeight: isGate ? 90 : 70,
          border: "2px solid rgba(255,255,255,0.15)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        },
      });

      if (n.parent_id) {
        edges.push({
          id: `e-${n.parent_id}-${n.id}`,
          source: n.parent_id,
          target: n.id,
          type: "smoothstep",
          animated: false,
          markerEnd: {
            type: MarkerType.ArrowClosed,
          },
          style: {
            stroke: "#94a3b8",
            strokeWidth: 2,
          },
        });
      }
    });

    return { nodes, edges };
  }

  async function handleCreateInvestigation() {
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

      setInvestigationForm({
        title: "",
        description: "",
        created_by: "",
        status: "Open",
      });

      await loadInvestigations(selectedEquipmentId);
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleUpdateInvestigation() {
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
      setEditingInvestigationId(null);

      await loadInvestigations(selectedEquipmentId);
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleDeleteInvestigation(id: string) {
    const confirmed = confirm("Delete this investigation?");
    if (!confirmed) return;

    try {
      await invoke("delete_investigation", { id });

      await loadInvestigations(selectedEquipmentId);
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleAddNode() {
    if (!selectedInvestigation) return;

    try {
      await invoke("add_rca_node", {
        payload: {
          investigationId: selectedInvestigation.id,
          parentId: nodeForm.parent_id || null,
          nodeType: nodeForm.node_type,
          gateType:
            nodeForm.node_type === "Gate"
              ? nodeForm.gate_type
              : null,
          title: nodeForm.title,
          description: nodeForm.description || null,
        },
      });

      setShowNodeForm(false);

      setNodeForm({
        parent_id: "",
        node_type: "TopEvent",
        gate_type: "AND",
        title: "",
        description: "",
      });

      await loadNodes(selectedInvestigation.id);
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleDeleteNode(id: string) {
    if (!selectedInvestigation) return;

    const confirmed = confirm("Delete this RCA node?");
    if (!confirmed) return;

    try {
      await invoke("delete_rca_node", { id });

      await loadNodes(selectedInvestigation.id);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[70vh] text-slate-400">
        Loading RCA workspace...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl">
        {error}
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-70px)] flex bg-slate-950 text-white overflow-hidden">

      {/* SIDEBAR */}

      <aside className="w-[340px] border-r border-slate-800 bg-slate-900 flex flex-col">

        {/* HEADER */}

        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold">RCA Workspace</h1>
              <p className="text-xs text-slate-400 mt-1">
                Fault Tree Analysis Management
              </p>
            </div>

            <button
              onClick={() => {
                setEditingInvestigationId(null);

                setInvestigationForm({
                  title: "",
                  description: "",
                  created_by: "",
                  status: "Open",
                });

                setShowInvestigationForm(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-500 px-3 py-2 rounded-lg text-sm font-medium"
            >
              + New
            </button>
          </div>

          <select
            value={selectedEquipmentId}
            onChange={(e) => loadInvestigations(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm outline-none"
          >
            <option value="">Select Equipment</option>

            {equipment.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {eq.tag_number} — {eq.name}
              </option>
            ))}
          </select>

          <input
            placeholder="Search investigations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full mt-3 bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm outline-none"
          />
        </div>

        {/* KPI */}

        <div className="grid grid-cols-2 gap-3 p-4 border-b border-slate-800">
          <div className="bg-slate-800 rounded-xl p-3">
            <p className="text-xs text-slate-400">Investigations</p>
            <h3 className="text-2xl font-bold mt-1">
              {stats.totalInvestigations}
            </h3>
          </div>

          <div className="bg-slate-800 rounded-xl p-3">
            <p className="text-xs text-slate-400">FTA Nodes</p>
            <h3 className="text-2xl font-bold mt-1">
              {stats.totalNodes}
            </h3>
          </div>
        </div>

        {/* LIST */}

        <div className="flex-1 overflow-y-auto p-4 space-y-3">

          {filteredInvestigations.length === 0 ? (
            <div className="text-center text-slate-500 mt-10 text-sm">
              No RCA investigations found.
            </div>
          ) : (
            filteredInvestigations.map((inv) => (
              <div
                key={inv.id}
                onClick={() => setSelectedInvestigation(inv)}
                className={`rounded-2xl border transition-all cursor-pointer p-4 ${
                  selectedInvestigation?.id === inv.id
                    ? "bg-slate-800 border-emerald-500"
                    : "bg-slate-900 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex justify-between gap-2">

                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold truncate">
                      {inv.title}
                    </h3>

                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className={`px-2 py-1 rounded-full text-[11px] font-medium ${
                          statusBadge[inv.status || ""] ||
                          "bg-slate-700"
                        }`}
                      >
                        {inv.status}
                      </span>
                    </div>

                    {inv.description && (
                      <p className="text-xs text-slate-400 mt-3 line-clamp-2">
                        {inv.description}
                      </p>
                    )}
                  </div>

                  <div
                    className="flex flex-col gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => openEditInvestigation(inv)}
                      className="text-slate-400 hover:text-blue-400 text-sm"
                    >
                      ✏️
                    </button>

                    <button
                      onClick={() =>
                        handleDeleteInvestigation(inv.id)
                      }
                      className="text-slate-400 hover:text-red-400 text-sm"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* FOOTER GUIDE */}

        <div className="border-t border-slate-800 p-4 text-xs text-slate-400 space-y-2">
          <p className="font-semibold text-slate-300">
            Fault Tree Legend
          </p>

          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-red-600 rounded-sm"></span>
            Top Event
          </div>

          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-amber-500 rounded-sm"></span>
            Intermediate Event
          </div>

          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-green-600 rounded-sm"></span>
            Basic Event
          </div>

          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-blue-600 rounded-full"></span>
            Logic Gate
          </div>
        </div>
      </aside>

      {/* MAIN */}

      <main className="flex-1 flex flex-col overflow-hidden">

        {selectedInvestigation ? (
          <>
            {/* TOPBAR */}

            <div className="border-b border-slate-800 bg-slate-900 px-6 py-4 flex items-center justify-between">

              <div>
                <h2 className="text-xl font-bold">
                  {selectedInvestigation.title}
                </h2>

                {selectedInvestigation.description && (
                  <p className="text-sm text-slate-400 mt-1">
                    {selectedInvestigation.description}
                  </p>
                )}
              </div>

              <button
                onClick={() => setShowNodeForm(true)}
                className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-xl font-medium"
              >
                + Add Node
              </button>
            </div>

            {/* FLOW */}

            <div className="flex-1 bg-slate-950">

              {rcaNodes.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-300 mb-2">
                      Empty Fault Tree
                    </h3>

                    <p className="text-slate-500">
                      Start by creating a Top Event node.
                    </p>
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
                  <MiniMap
                    style={{
                      background: "#0f172a",
                    }}
                  />

                  <Controls />

                  <Background
                    color="#334155"
                    gap={20}
                  />
                </ReactFlow>
              )}
            </div>

            {/* NODE PANEL */}

            {rcaNodes.length > 0 && (
              <div className="border-t border-slate-800 bg-slate-900 p-4 max-h-44 overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold">
                    RCA Nodes
                  </p>

                  <p className="text-xs text-slate-400">
                    {rcaNodes.length} nodes
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {rcaNodes.map((n) => (
                    <div
                      key={n.id}
                      className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 flex items-center gap-2 text-xs"
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{
                          background:
                            nodeColors[n.node_type || ""],
                        }}
                      />

                      <span>{n.title}</span>

                      {n.gate_type && (
                        <span className="text-slate-400">
                          ({n.gate_type})
                        </span>
                      )}

                      <button
                        onClick={() => handleDeleteNode(n.id)}
                        className="text-slate-500 hover:text-red-400 ml-1"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-slate-950">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-slate-300 mb-3">
                Root Cause Analysis
              </h2>

              <p className="text-slate-500 max-w-md">
                Select an investigation from the left panel or
                create a new RCA investigation to begin building
                a fault tree.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* INVESTIGATION MODAL */}

      {showInvestigationForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">

          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl">

            <h3 className="text-xl font-bold mb-5">
              {editingInvestigationId
                ? "Edit Investigation"
                : "Create Investigation"}
            </h3>

            <div className="space-y-4">

              <input
                value={investigationForm.title}
                onChange={(e) =>
                  setInvestigationForm({
                    ...investigationForm,
                    title: e.target.value,
                  })
                }
                placeholder="Investigation title"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3"
              />

              <textarea
                value={investigationForm.description}
                onChange={(e) =>
                  setInvestigationForm({
                    ...investigationForm,
                    description: e.target.value,
                  })
                }
                placeholder="Description"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 h-28 resize-none"
              />

              <input
                value={investigationForm.created_by}
                onChange={(e) =>
                  setInvestigationForm({
                    ...investigationForm,
                    created_by: e.target.value,
                  })
                }
                placeholder="Created by"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3"
              />

              {editingInvestigationId && (
                <select
                  value={investigationForm.status}
                  onChange={(e) =>
                    setInvestigationForm({
                      ...investigationForm,
                      status: e.target.value,
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3"
                >
                  <option value="Open">Open</option>
                  <option value="In Progress">
                    In Progress
                  </option>
                  <option value="Closed">Closed</option>
                </select>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowInvestigationForm(false);
                  setEditingInvestigationId(null);
                }}
                className="flex-1 border border-slate-700 hover:bg-slate-800 rounded-xl py-3"
              >
                Cancel
              </button>

              <button
                onClick={
                  editingInvestigationId
                    ? handleUpdateInvestigation
                    : handleCreateInvestigation
                }
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 rounded-xl py-3 font-medium"
              >
                {editingInvestigationId
                  ? "Update Investigation"
                  : "Create Investigation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NODE MODAL */}

      {showNodeForm && selectedInvestigation && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">

          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl">

            <h3 className="text-xl font-bold mb-5">
              Add RCA Node
            </h3>

            <div className="space-y-4">

              <input
                value={nodeForm.title}
                onChange={(e) =>
                  setNodeForm({
                    ...nodeForm,
                    title: e.target.value,
                  })
                }
                placeholder="Node title"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3"
              />

              <select
                value={nodeForm.node_type}
                onChange={(e) =>
                  setNodeForm({
                    ...nodeForm,
                    node_type: e.target.value,
                  })
                }
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3"
              >
                <option value="TopEvent">
                  🔴 Top Event
                </option>

                <option value="IntermediateEvent">
                  🟡 Intermediate Event
                </option>

                <option value="BasicEvent">
                  🟢 Basic Event
                </option>

                <option value="Gate">
                  🔵 Gate
                </option>
              </select>

              {nodeForm.node_type === "Gate" && (
                <select
                  value={nodeForm.gate_type}
                  onChange={(e) =>
                    setNodeForm({
                      ...nodeForm,
                      gate_type: e.target.value,
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3"
                >
                  <option value="AND">AND Gate</option>
                  <option value="OR">OR Gate</option>
                </select>
              )}

              <select
                value={nodeForm.parent_id}
                onChange={(e) =>
                  setNodeForm({
                    ...nodeForm,
                    parent_id: e.target.value,
                  })
                }
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3"
              >
                <option value="">
                  No Parent (Top Level)
                </option>

                {rcaNodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    [{n.node_type}] {n.title}
                  </option>
                ))}
              </select>

              <textarea
                value={nodeForm.description}
                onChange={(e) =>
                  setNodeForm({
                    ...nodeForm,
                    description: e.target.value,
                  })
                }
                placeholder="Description"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 h-24 resize-none"
              />
            </div>

            <div className="flex gap-3 mt-6">

              <button
                onClick={() => setShowNodeForm(false)}
                className="flex-1 border border-slate-700 hover:bg-slate-800 rounded-xl py-3"
              >
                Cancel
              </button>

              <button
                onClick={handleAddNode}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 rounded-xl py-3 font-medium"
              >
                Add Node
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RcaPage;