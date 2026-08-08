import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

interface AssistantCtx {
  open: boolean;
  /** The page the user is currently on, used for contextual tips. */
  page: string | null;
  openAssistant: (page?: string) => void;
  closeAssistant: () => void;
  toggleAssistant: () => void;
  setPage: (page: string) => void;
}

const Ctx = createContext<AssistantCtx | null>(null);

export function useAssistant() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAssistant must be used within an AssistantProvider");
  return ctx;
}

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [page, setPageState] = useState<string | null>(null);

  const openAssistant = useCallback((p?: string) => {
    if (p) setPageState(p);
    setOpen(true);
  }, []);

  const closeAssistant = useCallback(() => setOpen(false), []);
  const toggleAssistant = useCallback(() => setOpen((v) => !v), []);
  const setPage = useCallback((p: string) => setPageState(p), []);

  return (
    <Ctx.Provider value={{ open, page, openAssistant, closeAssistant, toggleAssistant, setPage }}>
      {children}
    </Ctx.Provider>
  );
}
