import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send, Sparkles, HelpCircle, RotateCcw, Settings, Cpu } from "lucide-react";
import TourMascot from "./TourMascot";
import { useTour } from "../context/TourContext";
import { useAssistant } from "../context/AssistantContext";
import {
  tipsForPage,
  pageLabel,
  SUGGESTED_QUESTIONS,
  askRuca,
  getLlmConfig,
  type LlmConfig,
} from "../lib/assistant";

interface Msg {
  id: number;
  from: "ruca" | "user";
  text: string;
}

let nextId = 1;

export default function Assistant() {
  const { open, page, closeAssistant, toggleAssistant } = useAssistant();
  const { openHelp, startTour } = useTour();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [llm, setLlm] = useState<LlmConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const currentPage = page ?? undefined;

  useEffect(() => {
    getLlmConfig().then(setLlm).catch(() => {});
  }, []);

  // Seed a contextual greeting + tips when the panel opens.
  useEffect(() => {
    if (open && messages.length === 0) {
      const tips = tipsForPage(currentPage);
      const intro: Msg = {
        id: nextId++,
        from: "ruca",
        text: `Hi, I'm Ruca — your TPM-RCA assistant. You're on ${pageLabel(currentPage)}. Here are a few tips to get going:`,
      };
      const tipMsgs: Msg[] = tips.map((t) => ({
        id: nextId++,
        from: "ruca",
        text: `• ${t.title}: ${t.body}`,
      }));
      setMessages([intro, ...tipMsgs]);
    }
  }, [open, page, messages.length]);

  // Re-show tips for the current page without losing the conversation.
  function showTipsAgain() {
    const tips = tipsForPage(currentPage);
    if (!tips.length) return;
    setMessages((m) => [
      ...m,
      {
        id: nextId++,
        from: "ruca",
        text: `Tips for ${pageLabel(currentPage)}:\n${tips.map((t) => `• ${t.title}: ${t.body}`).join("\n")}`,
      },
    ]);
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  function send(text: string) {
    const q = text.trim();
    if (!q) return;
    setMessages((m) => [...m, { id: nextId++, from: "user", text: q }]);
    setInput("");
    const history = messages
      .filter((m) => m.from === "user" || m.from === "ruca")
      .slice(-10)
      .map((m): { role: "user" | "assistant"; content: string } => ({
        role: m.from === "user" ? "user" : "assistant",
        content: m.text,
      }));
    void askRuca(q, currentPage, history).then((reply) => {
      setMessages((m) => [...m, { id: nextId++, from: "ruca", text: reply }]);
    });
  }

  async function saveLlmConfig() {
    if (!llm) return;
    setSaving(true);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const updated = await invoke<LlmConfig>("set_llm_config", {
        payload: {
          enabled: llm.enabled,
          provider: llm.provider,
          baseUrl: llm.baseUrl,
          model: llm.model,
          apiKey: llm.apiKey,
        },
      });
      setLlm({ ...llm, ...updated });
    } catch (err) {
      setMessages((m) => [...m, { id: nextId++, from: "ruca", text: `Could not save LLM settings: ${err}` }]);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={toggleAssistant}
        aria-label="Open Ruca assistant"
        className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/40 grid place-items-center hover:scale-105 transition"
      >
        <MessageCircle className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 w-[22rem] max-w-[calc(100vw-2.5rem)] h-[30rem] max-h-[calc(100vh-2.5rem)] flex flex-col rounded-2xl bg-white dark:bg-slate-800 shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 h-14 bg-gradient-to-r from-indigo-600 to-violet-600 text-white shrink-0">
        <TourMascot size={34} />
        <div className="leading-tight">
          <p className="font-semibold text-sm">Ruca Assistant</p>
          <p className="text-[11px] text-indigo-100">
            {llm?.enabled ? (
              <span className="inline-flex items-center gap-1">
                <Cpu className="w-3 h-3" /> {llm.provider} · {llm.model}
              </span>
            ) : (
              "Contextual help · offline"
            )}
          </p>
        </div>
        <button
          onClick={() => setShowSettings((v) => !v)}
          aria-label="Assistant settings"
          className="ml-auto p-1.5 rounded-lg hover:bg-white/20"
        >
          <Settings className="w-4 h-4" />
        </button>
        <button
          onClick={closeAssistant}
          aria-label="Close assistant"
          className="p-1.5 rounded-lg hover:bg-white/20"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* LLM settings */}
      {showSettings && llm && (
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 space-y-2.5">
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={llm.enabled}
              onChange={(e) => setLlm({ ...llm, enabled: e.target.checked })}
              className="w-4 h-4 accent-indigo-600"
            />
            Enable a language model
          </label>
          {llm.enabled && (
            <>
              <div className="flex gap-2">
                {["ollama", "openai"].map((p) => (
                  <button
                    key={p}
                    onClick={() => setLlm({ ...llm, provider: p, baseUrl: p === "ollama" ? "http://localhost:11434" : "https://api.openai.com/v1" })}
                    className={`flex-1 text-xs px-2 py-1.5 rounded-lg border transition capitalize ${
                      llm.provider === p
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-200"
                        : "border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <input
                value={llm.baseUrl}
                onChange={(e) => setLlm({ ...llm, baseUrl: e.target.value })}
                placeholder="Base URL (e.g. http://localhost:11434)"
                className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
              <input
                value={llm.model}
                onChange={(e) => setLlm({ ...llm, model: e.target.value })}
                placeholder="Model (e.g. llama3.2, gpt-4o-mini)"
                className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
              {llm.provider === "openai" && (
                <input
                  value={llm.apiKey}
                  onChange={(e) => setLlm({ ...llm, apiKey: e.target.value })}
                  type="password"
                  placeholder="API key (OpenAI-compatible)"
                  className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
              )}
              <button
                onClick={saveLlmConfig}
                disabled={saving}
                className="w-full text-xs font-medium px-2 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save settings"}
              </button>
              <p className="text-[10px] text-slate-400">
                Needs the Ruca assistant to stay offline? When no LLM is reachable, Ruca falls back to its built-in knowledge base.
              </p>
            </>
          )}
          {!llm.enabled && (
            <p className="text-[10px] text-slate-400">
              Keep Ruca fully offline. When enabled, answer quality depends on the model you connect.
            </p>
          )}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-slate-50 dark:bg-slate-900">
        {messages.map((m) =>
          m.from === "ruca" ? (
            <div key={m.id} className="flex gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500 mt-1 shrink-0" />
              <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line leading-relaxed">
                {m.text}
              </p>
            </div>
          ) : (
            <div key={m.id} className="flex justify-end">
              <p className="text-sm text-white bg-indigo-600 rounded-2xl rounded-br-sm px-3 py-2 max-w-[85%]">
                {m.text}
              </p>
            </div>
          )
        )}
      </div>

      {/* Suggested questions */}
      <div className="px-3 pt-2 flex flex-wrap gap-1.5 border-t border-slate-100 dark:border-slate-700">
        {SUGGESTED_QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => send(q)}
            className="text-[11px] px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Composer */}
      <div className="p-3 flex items-center gap-2 border-t border-slate-100 dark:border-slate-700">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(input)}
          placeholder="Ask Ruca anything…"
          className="flex-1 text-sm rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button
          onClick={() => send(input)}
          aria-label="Send"
          className="w-9 h-9 rounded-xl bg-indigo-600 text-white grid place-items-center hover:bg-indigo-500 shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      {/* Footer actions */}
      <div className="px-3 pb-3 flex gap-2">
        <button
          onClick={showTipsAgain}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 hover:text-indigo-600 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          <Sparkles className="w-3.5 h-3.5" /> Page tips
        </button>
        <button
          onClick={() => { closeAssistant(); openHelp(); }}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 hover:text-indigo-600 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          <HelpCircle className="w-3.5 h-3.5" /> Help
        </button>
        <button
          onClick={() => { closeAssistant(); startTour(); }}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 hover:text-indigo-600 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Tour
        </button>
      </div>
    </div>
  );
}
