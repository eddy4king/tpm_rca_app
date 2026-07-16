import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";

export type Lang = "en" | "es" | "fr";

export const LANGUAGES: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
];

/**
 * Translation dictionaries. Keys are dotted namespaces (e.g. `nav.dashboard`).
 * English is the source of truth and the fallback for any missing key.
 */
const DICTIONARY: Record<Lang, Record<string, string>> = {
  en: {
    "brand.subtitle": "Pro Maintenance",
    "nav.dashboard": "Dashboard",
    "nav.equipment": "Equipment",
    "nav.hierarchy": "Hierarchy",
    "nav.downtime": "Downtime",
    "nav.rca": "RCA",
    "nav.capa": "CAPA",
    "nav.pm": "PM Scheduler",
    "nav.tasks": "Tasks",
    "nav.timeline": "Timeline",
    "nav.audit": "Audit",
    "nav.sync": "Sync",
    "nav.users": "Users",
    "action.logout": "Logout",
    "common.language": "Language",
  },
  es: {
    "brand.subtitle": "Mantenimiento Pro",
    "nav.dashboard": "Panel",
    "nav.equipment": "Equipos",
    "nav.hierarchy": "Jerarquía",
    "nav.downtime": "Paradas",
    "nav.rca": "ACR",
    "nav.capa": "CAPA",
    "nav.pm": "Plan PM",
    "nav.tasks": "Tareas",
    "nav.timeline": "Cronología",
    "nav.audit": "Auditoría",
    "nav.sync": "Sincronizar",
    "nav.users": "Usuarios",
    "action.logout": "Cerrar sesión",
    "common.language": "Idioma",
  },
  fr: {
    "brand.subtitle": "Maintenance Pro",
    "nav.dashboard": "Tableau de bord",
    "nav.equipment": "Équipements",
    "nav.hierarchy": "Hiérarchie",
    "nav.downtime": "Arrêts",
    "nav.rca": "ACR",
    "nav.capa": "CAPA",
    "nav.pm": "Planificateur PM",
    "nav.tasks": "Tâches",
    "nav.timeline": "Chronologie",
    "nav.audit": "Audit",
    "nav.sync": "Synchro",
    "nav.users": "Utilisateurs",
    "action.logout": "Déconnexion",
    "common.language": "Langue",
  },
};

interface LanguageContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Translate a key, with an optional fallback string. */
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const stored = localStorage.getItem("lang") as Lang | null;
    if (stored && DICTIONARY[stored]) setLangState(stored);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem("lang", l);
    document.documentElement.setAttribute("lang", l);
  }, []);

  const t = useCallback(
    (key: string, fallback?: string) =>
      DICTIONARY[lang]?.[key] ?? DICTIONARY.en[key] ?? fallback ?? key,
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
