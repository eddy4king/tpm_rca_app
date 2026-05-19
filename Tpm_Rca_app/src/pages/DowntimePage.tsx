import {
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { invoke } from "@tauri-apps/api/core";

interface Equipment {
  id: string;
  name: string | null;
  tag_number: string | null;
}

interface Downtime {
  id: string;
  equipment_id: string;
  title: string | null;
  description: string | null;
  loss_category: string | null;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  reported_by: string | null;
  created_at: string | null;
}

function getLossCategoryColor(
  category: string | null
) {
  switch (category) {
    case "Breakdown":
      return "bg-red-100 text-red-800";

    case "Setup":
      return "bg-yellow-100 text-yellow-800";

    case "Minor Stoppage":
      return "bg-orange-100 text-orange-800";

    case "Speed Loss":
      return "bg-blue-100 text-blue-800";

    default:
      return "bg-gray-100 text-gray-800";
  }
}

function isClosed(dt: Downtime) {
  return !!dt.end_time;
}

const defaultForm = {
  equipment_id: "",
  title: "",
  description: "",
  loss_category: "Breakdown",
  start_time: new Date()
    .toISOString()
    .slice(0, 16),
  reported_by: "",
};

const defaultCloseForm = {
  end_time: new Date()
    .toISOString()
    .slice(0, 16),
};

function DowntimePage() {
  const [equipment, setEquipment] = useState<
    Equipment[]
  >([]);

  const [allDowntime, setAllDowntime] =
    useState<Downtime[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [selectedDowntime, setSelectedDowntime] =
    useState<Downtime | null>(null);

  const [
    editingDowntimeObj,
    setEditingDowntimeObj,
  ] = useState<Downtime | null>(null);

  const [ui, setUi] = useState({
    error: null as string | null,
    showForm: false,
    selectedEquipmentId: "",
    editingId: null as string | null,
  });

  const [form, setForm] = useState(
    defaultForm
  );

  const [closeForm, setCloseForm] =
    useState(defaultCloseForm);

  const equipmentMap = useMemo(() => {
    return new Map(
      equipment.map((eq) => [eq.id, eq])
    );
  }, [equipment]);

  const filteredDowntime = useMemo(() => {
    if (!ui.selectedEquipmentId) {
      return allDowntime;
    }

    return allDowntime.filter(
      (d) =>
        d.equipment_id ===
        ui.selectedEquipmentId
    );
  }, [allDowntime, ui.selectedEquipmentId]);

  const calculatedDuration = useMemo(() => {
    if (!editingDowntimeObj?.start_time)
      return 0;

    return Math.max(
      0,
      Math.floor(
        (new Date(
          closeForm.end_time
        ).getTime() -
          new Date(
            editingDowntimeObj.start_time
          ).getTime()) /
          60000
      )
    );
  }, [
    editingDowntimeObj,
    closeForm.end_time,
  ]);

  const stats = useMemo(() => {
    const open = allDowntime.filter(
      (d) => !d.end_time
    ).length;

    const closed = allDowntime.filter(
      (d) => d.end_time
    ).length;

    const totalMinutes =
      allDowntime.reduce(
        (acc, d) =>
          acc + (d.duration_minutes || 0),
        0
      );

    return {
      open,
      closed,
      totalMinutes,
    };
  }, [allDowntime]);

  function resetForm() {
    setForm(defaultForm);

    setCloseForm(defaultCloseForm);

    setEditingDowntimeObj(null);

    setUi((prev) => ({
      ...prev,
      editingId: null,
    }));
  }

  function getEquipmentName(id: string) {
    const eq = equipmentMap.get(id);

    return eq
      ? `${eq.tag_number} — ${eq.name}`
      : id;
  }

  const loadDowntime =
    useCallback(async () => {
      try {
        const data =
          await invoke<Downtime[]>(
            "get_all_downtime"
          );

        setAllDowntime(data);
      } catch (err) {
        setUi((prev) => ({
          ...prev,
          error: String(err),
        }));
      }
    }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const eq =
        await invoke<Equipment[]>(
          "get_all_equipment"
        );

      setEquipment(eq);

      await loadDowntime();

      setLoading(false);
    } catch (err) {
      setUi((prev) => ({
        ...prev,
        error: String(err),
      }));

      setLoading(false);
    }
  }, [loadDowntime]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = useCallback(
    async () => {
      try {
        await invoke("create_downtime", {
          payload: {
            equipmentId:
              form.equipment_id,
            title: form.title,
            description:
              form.description || null,
            lossCategory:
              form.loss_category,
            startTime:
              form.start_time,
            reportedBy:
              form.reported_by || null,
          },
        });

        await loadDowntime();

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
    },
    [form, loadDowntime]
  );

  const handleUpdate = useCallback(
    async () => {
      try {
        await invoke("update_downtime", {
          payload: {
            id: ui.editingId,
            title: form.title || null,
            description:
              form.description || null,
            lossCategory:
              form.loss_category || null,
            startTime:
              form.start_time || null,
            reportedBy:
              form.reported_by || null,
          },
        });

        await loadDowntime();

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
    },
    [form, loadDowntime, ui.editingId]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const confirmed = confirm(
        "Delete this downtime event?"
      );

      if (!confirmed) return;

      try {
        await invoke("delete_downtime", {
          id,
        });

        setAllDowntime((prev) =>
          prev.filter((d) => d.id !== id)
        );

        setSelectedDowntime(null);
      } catch (err) {
        setUi((prev) => ({
          ...prev,
          error: String(err),
        }));
      }
    },
    []
  );

  const handleClose = useCallback(
    async (id: string) => {
      try {
        await invoke("close_downtime", {
          id,
          endTime: closeForm.end_time,
          durationMinutes:
            calculatedDuration,
        });

        await loadDowntime();

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
    },
    [
      calculatedDuration,
      closeForm.end_time,
      loadDowntime,
    ]
  );

  function handleEdit(dt: Downtime) {
    setEditingDowntimeObj(dt);

    setUi((prev) => ({
      ...prev,
      editingId: dt.id,
      showForm: true,
    }));

    setForm({
      equipment_id: dt.equipment_id,
      title: dt.title || "",
      description:
        dt.description || "",
      loss_category:
        dt.loss_category || "Breakdown",
      start_time:
        dt.start_time ||
        new Date()
          .toISOString()
          .slice(0, 16),
      reported_by:
        dt.reported_by || "",
    });

    setSelectedDowntime(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-gray-500 animate-pulse">
          Loading downtime records...
        </p>
      </div>
    );
  }

  if (ui.error) {
    return (
      <div className="bg-red-100 border border-red-200 text-red-700 rounded p-4">
        {ui.error}
      </div>
    );
  }

  if (selectedDowntime) {
    return (
      <div className="bg-white rounded shadow p-6 max-w-4xl">
        <button
          onClick={() =>
            setSelectedDowntime(null)
          }
          className="text-slate-600 hover:text-slate-800 mb-4"
        >
          ← Back to Downtime List
        </button>

        <h2 className="text-3xl font-bold mb-1">
          {selectedDowntime.title}
        </h2>

        <p className="text-gray-500 mb-6">
          {getEquipmentName(
            selectedDowntime.equipment_id
          )}
        </p>

        <div className="grid grid-cols-2 gap-5">
          <div>
            <p className="text-sm text-gray-500">
              Loss Category
            </p>

            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${getLossCategoryColor(
                selectedDowntime.loss_category
              )}`}
            >
              {
                selectedDowntime.loss_category
              }
            </span>
          </div>

          <div>
            <p className="text-sm text-gray-500">
              Status
            </p>

            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  selectedDowntime.end_time
                    ? "bg-green-500"
                    : "bg-red-500 animate-pulse"
                }`}
              />

              <span className="font-medium">
                {selectedDowntime.end_time
                  ? "Closed"
                  : "Ongoing"}
              </span>
            </div>
          </div>

          <div>
            <p className="text-sm text-gray-500">
              Start Time
            </p>

            <p className="font-medium">
              {selectedDowntime.start_time ||
                "—"}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-500">
              End Time
            </p>

            <p className="font-medium">
              {selectedDowntime.end_time ||
                "—"}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-500">
              Duration
            </p>

            <p className="font-medium">
              {selectedDowntime.duration_minutes
                ? `${selectedDowntime.duration_minutes} min`
                : "—"}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-500">
              Reported By
            </p>

            <p className="font-medium">
              {selectedDowntime.reported_by ||
                "—"}
            </p>
          </div>

          <div className="col-span-2">
            <p className="text-sm text-gray-500">
              Description
            </p>

            <p className="font-medium">
              {selectedDowntime.description ||
                "—"}
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <button
            onClick={() =>
              handleEdit(selectedDowntime)
            }
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-500"
          >
            Edit
          </button>

          <button
            onClick={() =>
              handleDelete(
                selectedDowntime.id
              )
            }
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-500"
          >
            Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h2 className="text-3xl font-bold">
            Downtime Logger
          </h2>

          <p className="text-sm text-gray-500 mt-1">
            Track all downtime events
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
          className="bg-slate-800 text-white px-4 py-2 rounded hover:bg-slate-700"
        >
          + Log Downtime
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="bg-white rounded shadow p-4">
          <p className="text-sm text-gray-500">
            Open Downtime
          </p>

          <h3 className="text-3xl font-bold text-red-600">
            {stats.open}
          </h3>
        </div>

        <div className="bg-white rounded shadow p-4">
          <p className="text-sm text-gray-500">
            Closed Events
          </p>

          <h3 className="text-3xl font-bold text-green-600">
            {stats.closed}
          </h3>
        </div>

        <div className="bg-white rounded shadow p-4">
          <p className="text-sm text-gray-500">
            Total Downtime
          </p>

          <h3 className="text-3xl font-bold text-slate-700">
            {stats.totalMinutes} min
          </h3>
        </div>
      </div>

      <div className="mb-5">
        <select
          className="border p-2 rounded bg-white"
          value={
            ui.selectedEquipmentId
          }
          onChange={(e) =>
            setUi((prev) => ({
              ...prev,
              selectedEquipmentId:
                e.target.value,
            }))
          }
        >
          <option value="">
            All Equipment
          </option>

          {equipment.map((eq) => (
            <option
              key={eq.id}
              value={eq.id}
            >
              {eq.tag_number} —{" "}
              {eq.name}
            </option>
          ))}
        </select>
      </div>

      {ui.showForm && (
        <div className="bg-white rounded shadow p-5 mb-5 grid grid-cols-2 gap-4">
          <select
            className="border p-2 rounded col-span-2"
            value={form.equipment_id}
            onChange={(e) =>
              setForm({
                ...form,
                equipment_id:
                  e.target.value,
              })
            }
          >
            <option value="">
              Select Equipment
            </option>

            {equipment.map((eq) => (
              <option
                key={eq.id}
                value={eq.id}
              >
                {eq.tag_number} —{" "}
                {eq.name}
              </option>
            ))}
          </select>

          <input
            className="border p-2 rounded"
            placeholder="Title"
            value={form.title}
            onChange={(e) =>
              setForm({
                ...form,
                title: e.target.value,
              })
            }
          />

          <select
            className="border p-2 rounded"
            value={form.loss_category}
            onChange={(e) =>
              setForm({
                ...form,
                loss_category:
                  e.target.value,
              })
            }
          >
            <option>
              Breakdown
            </option>

            <option>
              Setup
            </option>

            <option>
              Minor Stoppage
            </option>

            <option>
              Speed Loss
            </option>
          </select>

          <input
            type="datetime-local"
            className="border p-2 rounded"
            value={form.start_time}
            onChange={(e) =>
              setForm({
                ...form,
                start_time:
                  e.target.value,
              })
            }
          />

          <input
            className="border p-2 rounded"
            placeholder="Reported By"
            value={form.reported_by}
            onChange={(e) =>
              setForm({
                ...form,
                reported_by:
                  e.target.value,
              })
            }
          />

          <textarea
            className="border p-2 rounded col-span-2 min-h-[100px]"
            placeholder="Description"
            value={form.description}
            onChange={(e) =>
              setForm({
                ...form,
                description:
                  e.target.value,
              })
            }
          />

          {editingDowntimeObj &&
            !editingDowntimeObj.end_time && (
              <div className="col-span-2 border-t pt-4 mt-2 bg-green-50 rounded p-4">
                <p className="font-semibold text-green-800 mb-3">
                  Close This Downtime
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-600 block mb-1">
                      End Time
                    </label>

                    <input
                      type="datetime-local"
                      className="border p-2 rounded w-full"
                      value={
                        closeForm.end_time
                      }
                      onChange={(e) =>
                        setCloseForm({
                          end_time:
                            e.target
                              .value,
                        })
                      }
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-600 block mb-1">
                      Duration
                    </label>

                    <input
                      readOnly
                      value={`${calculatedDuration} minutes`}
                      className="border p-2 rounded w-full bg-gray-100"
                    />
                  </div>

                  <button
                    onClick={() =>
                      handleClose(
                        editingDowntimeObj.id
                      )
                    }
                    className="col-span-2 bg-green-600 text-white py-2 rounded hover:bg-green-500"
                  >
                    ✓ Confirm Close
                    Downtime
                  </button>
                </div>
              </div>
            )}

          <button
            onClick={
              ui.editingId
                ? handleUpdate
                : handleCreate
            }
            className="bg-blue-600 text-white py-2 rounded hover:bg-blue-500 col-span-2"
          >
            {ui.editingId
              ? "Update Downtime"
              : "Save Downtime Event"}
          </button>
        </div>
      )}

      {filteredDowntime.length === 0 ? (
        <div className="bg-white rounded shadow p-10 text-center text-gray-500">
          No downtime events found.
        </div>
      ) : (
        <div className="bg-white rounded shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-800 text-white">
              <tr>
                <th className="p-3 text-left">
                  Equipment
                </th>

                <th className="p-3 text-left">
                  Title
                </th>

                <th className="p-3 text-left">
                  Category
                </th>

                <th className="p-3 text-left">
                  Status
                </th>

                <th className="p-3 text-left">
                  Duration
                </th>

                <th className="p-3 text-left">
                  Reported By
                </th>

                <th className="p-3 text-left">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredDowntime.map(
                (dt) => (
                  <tr
                    key={dt.id}
                    className="border-b hover:bg-blue-50 cursor-pointer"
                    onClick={() =>
                      setSelectedDowntime(
                        dt
                      )
                    }
                  >
                    <td className="p-3 text-sm">
                      {getEquipmentName(
                        dt.equipment_id
                      )}
                    </td>

                    <td className="p-3 font-medium">
                      {dt.title}
                    </td>

                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getLossCategoryColor(
                          dt.loss_category
                        )}`}
                      >
                        {
                          dt.loss_category
                        }
                      </span>
                    </td>

                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            dt.end_time
                              ? "bg-green-500"
                              : "bg-red-500 animate-pulse"
                          }`}
                        />

                        <span>
                          {dt.end_time
                            ? "Closed"
                            : "Ongoing"}
                        </span>
                      </div>
                    </td>

                    <td className="p-3">
                      {dt.duration_minutes
                        ? `${dt.duration_minutes} min`
                        : "—"}
                    </td>

                    <td className="p-3">
                      {dt.reported_by ||
                        "—"}
                    </td>

                    <td
                      className="p-3"
                      onClick={(e) =>
                        e.stopPropagation()
                      }
                    >
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            handleEdit(dt)
                          }
                          className="bg-blue-500 text-white px-2 py-1 rounded text-sm hover:bg-blue-400"
                        >
                          Edit
                        </button>

                        <button
                          onClick={() =>
                            handleDelete(
                              dt.id
                            )
                          }
                          className="bg-red-500 text-white px-2 py-1 rounded text-sm hover:bg-red-400"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default DowntimePage;