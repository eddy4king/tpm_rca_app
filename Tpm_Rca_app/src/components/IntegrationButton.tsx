import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export default function IntegrationButton() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const handleSend = async () => {
    try {
      await invoke("create_issue", { title, description });
      setStatus("Issue sent successfully");
    } catch (e) {
      setStatus(`Error: ${e}`);
    }
  };

  return (
    <div className="p-4 bg-white rounded-xl shadow">
      <h2 className="text-lg font-medium mb-2">Send Integration Issue</h2>
      <input
        placeholder="Title"
        value={title}
        onChange={e => setTitle(e.target.value)}
        className="w-full border p-2 mb-2 rounded"
      />
      <textarea
        placeholder="Description"
        value={description}
        onChange={e => setDescription(e.target.value)}
        className="w-full border p-2 mb-2 rounded"
        rows={3}
      />
      <button
        onClick={handleSend}
        className="bg-blue-600 text-white py-2 px-4 rounded"
      >
        Send Issue
      </button>
      {status && <p className="mt-2">{status}</p>}
    </div>
  );
}
