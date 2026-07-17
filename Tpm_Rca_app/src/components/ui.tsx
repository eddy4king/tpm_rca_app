import {
  ReactNode,
  forwardRef,
  useEffect,
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  SelectHTMLAttributes,
} from "react";

/* ============================================================================
 * Shared UI primitives — the canonical EquipmentPage design language.
 *
 * Palette / tokens (single source of truth for the app):
 *   - Primary action : bg-blue-600 hover:bg-blue-500
 *   - Edit           : bg-blue-600 hover:bg-blue-500
 *   - Danger/Delete  : bg-red-600 hover:bg-red-500
 *   - Success        : bg-emerald-600 hover:bg-emerald-500
 *   - Cards          : bg-white rounded-2xl border border-slate-200 shadow-sm
 *   - Controls focus : focus:ring-2 focus:ring-blue-500
 *   - Table header   : bg-slate-900 text-white
 *   - Badges         : px-2.5 py-1 rounded-full text-xs font-semibold + border
 *   - Loading        : centered blue spinner
 *   - Errors         : bg-red-50 border border-red-200 text-red-700
 *
 * Note: modals intentionally keep rounded-3xl shadow-2xl (distinct from content
 * cards) and indicators (StatusBadge/PriorityBadge) live in indicators.tsx.
 * ========================================================================== */

/* ----------------------------- Color tints ------------------------------- */
export const TINTS: Record<string, string> = {
  slate: "bg-slate-100 text-slate-600",
  indigo: "bg-indigo-100 text-indigo-600",
  emerald: "bg-emerald-100 text-emerald-600",
  amber: "bg-amber-100 text-amber-600",
  rose: "bg-rose-100 text-rose-600",
  sky: "bg-sky-100 text-sky-600",
  violet: "bg-violet-100 text-violet-600",
  teal: "bg-teal-100 text-teal-600",
  blue: "bg-blue-100 text-blue-700",
  orange: "bg-orange-100 text-orange-700",
  green: "bg-green-100 text-green-700",
  red: "bg-red-100 text-red-700",
  yellow: "bg-yellow-100 text-yellow-700",
};

/* ------------------------------- Button ---------------------------------- */
type ButtonVariant =
  | "primary"
  | "secondary"
  | "danger"
  | "edit"
  | "success"
  | "ghost";
type ButtonSize = "sm" | "md";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 font-medium transition-colors duration-150 " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 " +
  "disabled:opacity-40 disabled:cursor-not-allowed";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-blue-600 text-white hover:bg-blue-500 shadow-sm rounded-xl px-5 py-2.5",
  secondary: "border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl px-5 py-2.5",
  danger: "bg-red-600 text-white hover:bg-red-500 shadow-sm rounded-xl px-5 py-2.5",
  edit: "bg-blue-600 text-white hover:bg-blue-500 shadow-sm rounded-xl px-5 py-2.5",
  success: "bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm rounded-xl px-5 py-2.5",
  ghost: "text-slate-600 hover:bg-slate-100 rounded-xl px-5 py-2.5",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm rounded-lg",
  md: "px-5 py-2.5 text-sm",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading = false, className = "", children, disabled, type, ...props }, ref) => (
    <button
      ref={ref}
      type={type || "button"}
      disabled={disabled || loading}
      className={`${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${className}`}
      {...props}
    >
      {loading && <Spinner className="w-4 h-4 border-2" />}
      {children}
    </button>
  )
);
Button.displayName = "Button";

/* ----------------------------- IconButton -------------------------------- */
type IconButtonVariant = "edit" | "danger" | "success" | "ghost";

const ICONBUTTON_BASE =
  "inline-flex items-center justify-center rounded-lg transition " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

const ICONBUTTON_VARIANTS: Record<IconButtonVariant, string> = {
  edit: "text-blue-600 hover:bg-blue-50",
  danger: "text-red-600 hover:bg-red-50",
  success: "text-emerald-600 hover:bg-emerald-50",
  ghost: "text-slate-500 hover:bg-slate-100",
};

export function IconButton({
  variant = "ghost",
  size = "sm",
  label,
  className = "",
  children,
  ...props
}: IconButtonVariantProps) {
  const pad = size === "md" ? "p-2.5" : "p-2";
  return (
    <button
      aria-label={label}
      title={label}
      className={`${ICONBUTTON_BASE} ${ICONBUTTON_VARIANTS[variant]} ${pad} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

interface IconButtonVariantProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant;
  size?: ButtonSize;
  label: string;
}

/* -------------------------------- Card ----------------------------------- */
export function Card({
  className = "",
  children,
  onClick,
}: {
  className?: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl border border-slate-200 p-5 shadow-sm ${onClick ? "cursor-pointer " : ""}${className}`}
    >
      {children}
    </div>
  );
}

/* --------------------------- Form controls ------------------------------- */
const CONTROL =
  "w-full border border-slate-300 rounded-xl bg-white px-4 py-3 text-sm text-slate-800 " +
  "placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => (
    <input ref={ref} className={`${CONTROL} ${className}`} {...props} />
  )
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = "", ...props }, ref) => (
    <textarea ref={ref} className={`${CONTROL} min-h-[100px] resize-y ${className}`} {...props} />
  )
);
Textarea.displayName = "Textarea";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = "", children, ...props }, ref) => (
    <select ref={ref} className={`${CONTROL} ${className}`} {...props}>
      {children}
    </select>
  )
);
Select.displayName = "Select";

export function Field({
  label,
  htmlFor,
  children,
  className = "",
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={`block ${className}`}>
      <span className="text-sm font-semibold text-slate-600 block mb-1.5">{label}</span>
      {children}
    </label>
  );
}

/* ------------------------------- Badge ----------------------------------- */
export function Badge({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${className || "bg-slate-100 text-slate-700 border-slate-200"}`}
    >
      {children}
    </span>
  );
}

/* ------------------------------- Modal ----------------------------------- */
export function Modal({
  title,
  onClose,
  children,
  maxWidth = "max-w-2xl",
  closeOnBackdrop = true,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
  closeOnBackdrop?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        className={`bg-white rounded-3xl shadow-2xl w-full ${maxWidth} p-6 max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-slate-800">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-slate-500 hover:text-slate-800 text-lg"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* --------------------------- ConfirmDialog ------------------------------- */
export function ConfirmDialog({
  open,
  title = "Confirm",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ButtonVariant;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <Modal title={title} onClose={onCancel} maxWidth="max-w-md">
      <p className="text-sm text-slate-600">{message}</p>
      <div className="flex justify-end gap-3 mt-6">
        <Button variant="secondary" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant={variant} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

/* ------------------------------ Spinner ---------------------------------- */
export function Spinner({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <div
      className={`${className} border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin`}
      role="status"
      aria-label="Loading"
    />
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="text-center">
        <Spinner />
        <p className="text-slate-500 mt-4">{label}</p>
      </div>
    </div>
  );
}

/* ------------------------------- Banner ---------------------------------- */
type BannerTone = "error" | "success" | "info";

const BANNER_TONES: Record<BannerTone, string> = {
  error: "bg-red-50 border border-red-200 text-red-700",
  success: "bg-emerald-50 border border-emerald-200 text-emerald-700",
  info: "bg-slate-50 border border-slate-200 text-slate-700",
};

export function Banner({
  tone = "info",
  children,
  className = "",
}: {
  tone?: BannerTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl p-4 text-sm ${BANNER_TONES[tone]} ${className}`} role="status">
      {children}
    </div>
  );
}

/* ----------------------------- EmptyState -------------------------------- */
export function EmptyState({
  icon,
  title,
  description,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="text-center py-16">
      {icon && <div className="mx-auto mb-3 w-12 h-12 text-slate-300">{icon}</div>}
      <p className="text-lg font-semibold text-slate-400">{title}</p>
      {description && <p className="text-sm text-slate-500 mt-2">{description}</p>}
    </div>
  );
}

/* ------------------------------- Table ----------------------------------- */
export function TableCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export const tableHeadClass = "bg-slate-900 text-white";
export const thClass = "p-4 text-left text-sm font-medium";
export const tdClass = "p-4";
export const trClass = "border-b border-slate-100 hover:bg-slate-50 transition";

/* ------------------------------ StatCard --------------------------------- */
export function StatCard({
  icon,
  tint = "slate",
  label,
  value,
  sub,
}: {
  icon?: ReactNode;
  tint?: string;
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center gap-4">
      {icon && (
        <div className={`w-11 h-11 rounded-xl grid place-items-center shrink-0 ${TINTS[tint] || TINTS.slate}`}>
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-sm text-slate-500">{label}</p>
        <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

/* ------------------------------ Info pair -------------------------------- */
export function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="font-medium mt-1 text-slate-800">{value || "—"}</p>
    </div>
  );
}

/* ----------------------------- PageHeader -------------------------------- */
export function PageHeader({
  title,
  subtitle,
  actions,
  live,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  live?: boolean;
}) {
  return (
    <div className="flex justify-between items-start flex-wrap gap-4">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold text-slate-800">{title}</h1>
          {live && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Live
            </span>
          )}
        </div>
        {subtitle && <p className="text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}
