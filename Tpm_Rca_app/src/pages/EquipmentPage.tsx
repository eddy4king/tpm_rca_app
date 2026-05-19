import {
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";

import { invoke } from "@tauri-apps/api/core";

interface Equipment {
  id: string;
  tag_number: string | null;
  name: string | null;
  description: string | null;
  location: string | null;
  criticality: string | null;
  status: string | null;
  equipment_type: string | null;
  parent_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

const defaultForm = {
  tag_number: "",
  name: "",
  description: "",
  location: "",
  criticality: "Medium",
  status: "Running",
  equipment_type: "",
  parent_id: "",
};

function getStatusColor(
  status: string | null
) {
  switch (status) {
    case "Running":
      return "bg-green-100 text-green-700 border border-green-200";

    case "Standby":
      return "bg-blue-100 text-blue-700 border border-blue-200";

    case "Under Maintenance":
      return "bg-yellow-100 text-yellow-700 border border-yellow-200";

    case "Failed":
      return "bg-red-100 text-red-700 border border-red-200";

    default:
      return "bg-gray-100 text-gray-700 border border-gray-200";
  }
}

function getCriticalityColor(
  criticality: string | null
) {
  switch (criticality) {
    case "Critical":
      return "bg-red-100 text-red-700 border border-red-200";

    case "High":
      return "bg-orange-100 text-orange-700 border border-orange-200";

    case "Medium":
      return "bg-yellow-100 text-yellow-700 border border-yellow-200";

    case "Low":
      return "bg-green-100 text-green-700 border border-green-200";

    default:
      return "bg-gray-100 text-gray-700 border border-gray-200";
  }
}

function EquipmentPage() {
  const [equipment, setEquipment] =
    useState<Equipment[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [selectedEquipment, setSelectedEquipment] =
    useState<Equipment | null>(null);

  const [ui, setUi] = useState({
    error: null as string | null,
    showForm: false,
    editingId: null as string | null,
    search: "",
    statusFilter: "",
    criticalityFilter: "",
    typeFilter: "",
  });

  const [form, setForm] =
    useState(defaultForm);

  const stats = useMemo(() => {
    return {
      total: equipment.length,

      running: equipment.filter(
        (e) => e.status === "Running"
      ).length,

      failed: equipment.filter(
        (e) => e.status === "Failed"
      ).length,

      maintenance: equipment.filter(
        (e) =>
          e.status ===
          "Under Maintenance"
      ).length,
    };
  }, [equipment]);

  const equipmentTypes = useMemo(() => {
    return [
      ...new Set(
        equipment
          .map(
            (e) =>
              e.equipment_type
          )
          .filter(Boolean)
      ),
    ];
  }, [equipment]);

  const filteredEquipment =
    useMemo(() => {
      return equipment.filter((eq) => {
        const matchesSearch =
          !ui.search ||
          `${eq.tag_number} ${eq.name} ${eq.location} ${eq.equipment_type}`
            .toLowerCase()
            .includes(
              ui.search.toLowerCase()
            );

        const matchesStatus =
          !ui.statusFilter ||
          eq.status ===
            ui.statusFilter;

        const matchesCriticality =
          !ui.criticalityFilter ||
          eq.criticality ===
            ui.criticalityFilter;

        const matchesType =
          !ui.typeFilter ||
          eq.equipment_type ===
            ui.typeFilter;

        return (
          matchesSearch &&
          matchesStatus &&
          matchesCriticality &&
          matchesType
        );
      });
    }, [equipment, ui]);

  const loadEquipment =
    useCallback(async () => {
      try {
        setLoading(true);

        const data =
          await invoke<Equipment[]>(
            "get_all_equipment"
          );

        setEquipment(data);
      } catch (err) {
        setUi((prev) => ({
          ...prev,
          error: String(err),
        }));
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    loadEquipment();
  }, [loadEquipment]);

  function resetForm() {
    setForm(defaultForm);

    setUi((prev) => ({
      ...prev,
      editingId: null,
    }));
  }

  async function handleCreate() {
    try {
      await invoke(
        "create_equipment",
        {
          payload: {
            tagNumber:
              form.tag_number,
            name: form.name,
            description:
              form.description ||
              null,
            location:
              form.location ||
              null,
            criticality:
              form.criticality,
            status: form.status,
            equipmentType:
              form.equipment_type ||
              null,
            parentId:
              form.parent_id ||
              null,
          },
        }
      );

      await loadEquipment();

      resetForm();

      setUi((prev) => ({
        ...prev,
        showForm: false,
      }));
    } catch (err) {
      setUi((prev) => ({
        ...prev,
        error: String(err),
      }));
    }
  }

  async function handleUpdate() {
    try {
      await invoke(
        "update_equipment",
        {
          payload: {
            id: ui.editingId,
            tagNumber:
              form.tag_number ||
              null,
            name:
              form.name || null,
            description:
              form.description ||
              null,
            location:
              form.location ||
              null,
            criticality:
              form.criticality ||
              null,
            status:
              form.status || null,
            equipmentType:
              form.equipment_type ||
              null,
            parentId:
              form.parent_id ||
              null,
          },
        }
      );

      await loadEquipment();

      resetForm();

      setUi((prev) => ({
        ...prev,
        showForm: false,
      }));
    } catch (err) {
      setUi((prev) => ({
        ...prev,
        error: String(err),
      }));
    }
  }

  async function handleDelete(
    id: string
  ) {
    const confirmed = confirm(
      "Delete this equipment?"
    );

    if (!confirmed) return;

    try {
      await invoke(
        "delete_equipment",
        { id }
      );

      setEquipment((prev) =>
        prev.filter(
          (eq) => eq.id !== id
        )
      );

      setSelectedEquipment(null);
    } catch (err) {
      setUi((prev) => ({
        ...prev,
        error: String(err),
      }));
    }
  }

  function handleEdit(eq: Equipment) {
    setForm({
      tag_number:
        eq.tag_number || "",
      name: eq.name || "",
      description:
        eq.description || "",
      location:
        eq.location || "",
      criticality:
        eq.criticality ||
        "Medium",
      status:
        eq.status || "Running",
      equipment_type:
        eq.equipment_type || "",
      parent_id:
        eq.parent_id || "",
    });

    setUi((prev) => ({
      ...prev,
      editingId: eq.id,
      showForm: true,
    }));

    setSelectedEquipment(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-slate-300 border-t-slate-700 rounded-full animate-spin mx-auto mb-4" />

          <p className="text-gray-500">
            Loading equipment...
          </p>
        </div>
      </div>
    );
  }

  if (ui.error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
        {ui.error}
      </div>
    );
  }

  if (selectedEquipment) {
    return (
      <div className="space-y-5">
        <button
          onClick={() =>
            setSelectedEquipment(
              null
            )
          }
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          ← Back to Equipment
        </button>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex justify-between items-start mb-8">
            <div>
              <p className="text-sm text-slate-500">
                {
                  selectedEquipment.tag_number
                }
              </p>

              <h2 className="text-3xl font-bold text-slate-800 mt-1">
                {
                  selectedEquipment.name
                }
              </h2>
            </div>

            <div className="flex gap-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                  selectedEquipment.status
                )}`}
              >
                {
                  selectedEquipment.status
                }
              </span>

              <span
                className={`px-3 py-1 rounded-full text-xs font-medium ${getCriticalityColor(
                  selectedEquipment.criticality
                )}`}
              >
                {
                  selectedEquipment.criticality
                }
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-slate-500">
                Equipment Type
              </p>

              <p className="font-medium mt-1">
                {selectedEquipment.equipment_type ||
                  "—"}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-500">
                Location
              </p>

              <p className="font-medium mt-1">
                {selectedEquipment.location ||
                  "—"}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-500">
                Parent Equipment
              </p>

              <p className="font-medium mt-1">
                {selectedEquipment.parent_id ||
                  "—"}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-500">
                Created
              </p>

              <p className="font-medium mt-1">
                {selectedEquipment.created_at ||
                  "—"}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-500">
                Updated
              </p>

              <p className="font-medium mt-1">
                {selectedEquipment.updated_at ||
                  "—"}
              </p>
            </div>

            <div className="col-span-2">
              <p className="text-sm text-slate-500">
                Description
              </p>

              <p className="font-medium mt-1 whitespace-pre-wrap leading-relaxed">
                {selectedEquipment.description ||
                  "—"}
              </p>
            </div>
          </div>

          <div className="flex gap-3 mt-8">
            <button
              onClick={() =>
                handleEdit(
                  selectedEquipment
                )
              }
              className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-500 transition"
            >
              Edit Equipment
            </button>

            <button
              onClick={() =>
                handleDelete(
                  selectedEquipment.id
                )
              }
              className="bg-red-600 text-white px-5 py-2 rounded-lg hover:bg-red-500 transition"
            >
              Delete Equipment
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">
            Equipment Register
          </h1>

          <p className="text-slate-500 mt-1">
            Centralized industrial
            equipment management
          </p>
        </div>

        <button
          onClick={() => {
            resetForm();

            setUi((prev) => ({
              ...prev,
              showForm:
                !prev.showForm,
            }));
          }}
          className="bg-slate-800 text-white px-5 py-3 rounded-xl hover:bg-slate-700 transition shadow-sm"
        >
          + Add Equipment
        </button>
      </div>

      <div className="grid grid-cols-4 gap-5">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Total Equipment
          </p>

          <h3 className="text-3xl font-bold mt-2">
            {stats.total}
          </h3>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Running
          </p>

          <h3 className="text-3xl font-bold text-green-600 mt-2">
            {stats.running}
          </h3>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Under Maintenance
          </p>

          <h3 className="text-3xl font-bold text-yellow-600 mt-2">
            {
              stats.maintenance
            }
          </h3>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Failed
          </p>

          <h3 className="text-3xl font-bold text-red-600 mt-2">
            {stats.failed}
          </h3>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="grid grid-cols-4 gap-4">
          <input
            placeholder="Search equipment..."
            value={ui.search}
            onChange={(e) =>
              setUi((prev) => ({
                ...prev,
                search:
                  e.target.value,
              }))
            }
            className="border border-slate-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-slate-400"
          />

          <select
            value={ui.statusFilter}
            onChange={(e) =>
              setUi((prev) => ({
                ...prev,
                statusFilter:
                  e.target.value,
              }))
            }
            className="border border-slate-300 rounded-xl p-3"
          >
            <option value="">
              All Status
            </option>

            <option>
              Running
            </option>

            <option>
              Standby
            </option>

            <option>
              Under Maintenance
            </option>

            <option>
              Failed
            </option>
          </select>

          <select
            value={
              ui.criticalityFilter
            }
            onChange={(e) =>
              setUi((prev) => ({
                ...prev,
                criticalityFilter:
                  e.target.value,
              }))
            }
            className="border border-slate-300 rounded-xl p-3"
          >
            <option value="">
              All Criticality
            </option>

            <option>
              Critical
            </option>

            <option>
              High
            </option>

            <option>
              Medium
            </option>

            <option>
              Low
            </option>
          </select>

          <select
            value={ui.typeFilter}
            onChange={(e) =>
              setUi((prev) => ({
                ...prev,
                typeFilter:
                  e.target.value,
              }))
            }
            className="border border-slate-300 rounded-xl p-3"
          >
            <option value="">
              All Types
            </option>

            {equipmentTypes.map(
              (type) => (
                <option
                  key={String(type)}
                >
                  {type}
                </option>
              )
            )}
          </select>
        </div>
      </div>

      {ui.showForm && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold">
              {ui.editingId
                ? "Edit Equipment"
                : "Create Equipment"}
            </h3>

            <button
              onClick={() =>
                setUi((prev) => ({
                  ...prev,
                  showForm: false,
                }))
              }
              className="text-slate-500 hover:text-slate-800"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <input
              placeholder="Tag Number"
              value={form.tag_number}
              onChange={(e) =>
                setForm({
                  ...form,
                  tag_number:
                    e.target.value,
                })
              }
              className="border border-slate-300 rounded-xl p-3"
            />

            <input
              placeholder="Equipment Name"
              value={form.name}
              onChange={(e) =>
                setForm({
                  ...form,
                  name:
                    e.target.value,
                })
              }
              className="border border-slate-300 rounded-xl p-3"
            />

            <input
              placeholder="Equipment Type"
              value={
                form.equipment_type
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  equipment_type:
                    e.target.value,
                })
              }
              className="border border-slate-300 rounded-xl p-3"
            />

            <input
              placeholder="Location"
              value={form.location}
              onChange={(e) =>
                setForm({
                  ...form,
                  location:
                    e.target.value,
                })
              }
              className="border border-slate-300 rounded-xl p-3"
            />

            <select
              value={
                form.criticality
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  criticality:
                    e.target.value,
                })
              }
              className="border border-slate-300 rounded-xl p-3"
            >
              <option>
                Critical
              </option>

              <option>
                High
              </option>

              <option>
                Medium
              </option>

              <option>
                Low
              </option>
            </select>

            <select
              value={form.status}
              onChange={(e) =>
                setForm({
                  ...form,
                  status:
                    e.target.value,
                })
              }
              className="border border-slate-300 rounded-xl p-3"
            >
              <option>
                Running
              </option>

              <option>
                Standby
              </option>

              <option>
                Under Maintenance
              </option>

              <option>
                Failed
              </option>
            </select>

            <input
              placeholder="Parent Equipment ID (optional)"
              value={form.parent_id}
              onChange={(e) =>
                setForm({
                  ...form,
                  parent_id:
                    e.target.value,
                })
              }
              className="border border-slate-300 rounded-xl p-3 col-span-2"
            />

            <textarea
              placeholder="Description"
              value={form.description}
              onChange={(e) =>
                setForm({
                  ...form,
                  description:
                    e.target.value,
                })
              }
              className="border border-slate-300 rounded-xl p-3 min-h-[120px] col-span-2"
            />

            <button
              onClick={
                ui.editingId
                  ? handleUpdate
                  : handleCreate
              }
              className="bg-slate-800 text-white py-3 rounded-xl hover:bg-slate-700 transition col-span-2 font-medium"
            >
              {ui.editingId
                ? "Update Equipment"
                : "Save Equipment"}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900 text-white">
              <tr>
                <th className="p-4 text-left text-sm font-medium">
                  Tag
                </th>

                <th className="p-4 text-left text-sm font-medium">
                  Equipment
                </th>

                <th className="p-4 text-left text-sm font-medium">
                  Type
                </th>

                <th className="p-4 text-left text-sm font-medium">
                  Location
                </th>

                <th className="p-4 text-left text-sm font-medium">
                  Status
                </th>

                <th className="p-4 text-left text-sm font-medium">
                  Criticality
                </th>

                <th className="p-4 text-left text-sm font-medium">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredEquipment.map(
                (eq) => (
                  <tr
                    key={eq.id}
                    onClick={() =>
                      setSelectedEquipment(
                        eq
                      )
                    }
                    className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition"
                  >
                    <td className="p-4 font-medium text-slate-700">
                      {
                        eq.tag_number
                      }
                    </td>

                    <td className="p-4">
                      <div>
                        <p className="font-semibold text-slate-800">
                          {eq.name}
                        </p>

                        <p className="text-xs text-slate-500 mt-1">
                          {eq.description?.slice(
                            0,
                            50
                          ) ||
                            "No description"}
                        </p>
                      </div>
                    </td>

                    <td className="p-4">
                      {
                        eq.equipment_type
                      }
                    </td>

                    <td className="p-4">
                      {eq.location}
                    </td>

                    <td className="p-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          eq.status
                        )}`}
                      >
                        {eq.status}
                      </span>
                    </td>

                    <td className="p-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${getCriticalityColor(
                          eq.criticality
                        )}`}
                      >
                        {
                          eq.criticality
                        }
                      </span>
                    </td>

                    <td
                      className="p-4"
                      onClick={(e) =>
                        e.stopPropagation()
                      }
                    >
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            handleEdit(eq)
                          }
                          className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-500 transition"
                        >
                          Edit
                        </button>

                        <button
                          onClick={() =>
                            handleDelete(
                              eq.id
                            )
                          }
                          className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-red-500 transition"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}

              {filteredEquipment.length ===
                0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="p-10 text-center text-slate-500"
                  >
                    No equipment found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default EquipmentPage;