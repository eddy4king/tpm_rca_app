import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import TourOverlay from "../components/Tour";
import HelpModal from "../components/HelpModal";

export interface TourStep {
  /** CSS selector of the element to spotlight. Omit for a centered message. */
  target?: string;
  title: string;
  body: string;
  /** Navigate to this page before showing the step. */
  page?: string;
  placement?: "auto" | "bottom" | "top" | "right" | "left";
}

const STORAGE_KEY = "tpmRca.tourCompleted";

interface TourCtx {
  isOpen: boolean;
  step: number;
  steps: TourStep[];
  helpOpen: boolean;
  startTour: () => void;
  stopTour: () => void;
  next: () => void;
  prev: () => void;
  skip: () => void;
  openHelp: () => void;
  closeHelp: () => void;
  navigate: (page: string) => void;
}

const Ctx = createContext<TourCtx | null>(null);

export function useTour() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTour must be used within a TourProvider");
  return ctx;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: "Welcome to TPM-RCA",
    body: "This quick tour highlights the essentials. You can skip at any time, or reopen it later from Help (?).",
    placement: "auto",
  },
  {
    target: "[data-tour='nav']",
    title: "Navigate modules",
    body: "Jump between Dashboard, Equipment, Downtime, RCA, PM and the rest of the modules from here.",
    placement: "right",
  },
  {
    target: "[data-tour='actions']",
    title: "Theme & language",
    body: "Switch between dark and light mode, or change the interface language whenever you like.",
    placement: "top",
  },
  {
    target: "[data-tour='help']",
    title: "Need help?",
    body: "Open contextual help for tips on every module, plus a button to replay this tour.",
    placement: "top",
  },
  {
    page: "dashboard",
    target: "[data-tour='dashboard-kpi']",
    title: "Live KPIs",
    body: "Keep an eye on availability, MTTR, MTBF and open downtime at a glance.",
    placement: "bottom",
  },
  {
    page: "equipment",
    target: "[data-tour='add-equipment']",
    title: "Manage equipment",
    body: "Add assets, import a bulk list via CSV, scan QR tags and export reports — all from this page.",
    placement: "bottom",
  },
];

export function TourProvider({
  children,
  navigate,
}: {
  children: ReactNode;
  navigate: (page: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);

  const startTour = useCallback(() => {
    setStep(0);
    setIsOpen(true);
  }, []);

  const finish = useCallback(() => {
    setIsOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore storage errors */
    }
  }, []);

  const skip = useCallback(() => finish(), [finish]);

  const next = useCallback(() => {
    setStep((s) => {
      if (s >= TOUR_STEPS.length - 1) {
        finish();
        return s;
      }
      return s + 1;
    });
  }, [finish]);

  const prev = useCallback(() => setStep((s) => Math.max(0, s - 1)), []);

  // Auto-start the tour once, for first-time users.
  useEffect(() => {
    let seen = false;
    try {
      seen = !!localStorage.getItem(STORAGE_KEY);
    } catch {
      seen = false;
    }
    if (!seen) {
      const t = setTimeout(() => startTour(), 700);
      return () => clearTimeout(t);
    }
  }, [startTour]);

  // Global shortcut: Escape closes help; "?" opens help.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (e.key === "Escape" && helpOpen) setHelpOpen(false);
      if (e.key === "?" && !typing) {
        e.preventDefault();
        setHelpOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [helpOpen]);

  const value: TourCtx = {
    isOpen,
    step,
    steps: TOUR_STEPS,
    helpOpen,
    startTour,
    stopTour: finish,
    next,
    prev,
    skip,
    openHelp: () => setHelpOpen(true),
    closeHelp: () => setHelpOpen(false),
    navigate,
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      {isOpen && <TourOverlay />}
      {helpOpen && <HelpModal />}
    </Ctx.Provider>
  );
}
