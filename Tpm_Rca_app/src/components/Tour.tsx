import { useEffect, useState } from "react";
import { useTour } from "../context/TourContext";
import { Button } from "./ui";
import TourMascot from "./TourMascot";

const TOOLTIP_W = 320;
const TOOLTIP_H = 190;

export default function TourOverlay() {
  const { steps, step, next, prev, skip, navigate } = useTour();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const current = steps[step];

  useEffect(() => {
    if (current?.page) {
      navigate(current.page);
    }

    let attempts = 0;
    let timer: number;
    const tryLocate = () => {
      if (current?.target) {
        const el = document.querySelector(current.target);
        if (el) {
          setRect(el.getBoundingClientRect());
          return;
        }
      }
      setRect(null);
      if (attempts++ < 10) timer = window.setTimeout(tryLocate, 120);
    };
    timer = window.setTimeout(tryLocate, 80);

    const onResize = () => tryLocate();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [step, current]);

  // Geometry for the tooltip.
  let tipTop = 0;
  let tipLeft = 0;
  if (rect) {
    const below = rect.bottom + 14 + TOOLTIP_H < window.innerHeight;
    tipTop = below ? rect.bottom + 14 : rect.top - 14 - TOOLTIP_H;
    tipTop = Math.max(12, Math.min(tipTop, window.innerHeight - TOOLTIP_H - 12));
    tipLeft = rect.left + rect.width / 2 - TOOLTIP_W / 2;
    tipLeft = Math.max(12, Math.min(tipLeft, window.innerWidth - TOOLTIP_W - 12));
  } else {
    tipTop = window.innerHeight / 2 - TOOLTIP_H / 2;
    tipLeft = window.innerWidth / 2 - TOOLTIP_W / 2;
  }

  // Mascot ("teacher") sits at the bottom-left of the speech bubble.
  const MASCOT_W = 88;
  const MASCOT_H = 106;
  let mLeft = tipLeft - 26;
  let mTop = tipTop + TOOLTIP_H - 48;
  mLeft = Math.max(8, Math.min(mLeft, window.innerWidth - MASCOT_W - 8));
  mTop = Math.max(8, Math.min(mTop, window.innerHeight - MASCOT_H - 8));

  const spotStyle = rect
    ? {
        position: "fixed" as const,
        top: rect.top - 8,
        left: rect.left - 8,
        width: rect.width + 16,
        height: rect.height + 16,
        borderRadius: 12,
        boxShadow: "0 0 0 9999px rgba(15,23,42,0.72)",
        pointerEvents: "none" as const,
        zIndex: 60,
        transition: "all 0.2s ease",
      }
    : {
        position: "fixed" as const,
        inset: 0,
        background: "rgba(15,23,42,0.72)",
        pointerEvents: "none" as const,
        zIndex: 60,
      };

  return (
    <div className="fixed inset-0 z-[55]">
      <div style={spotStyle} />

      <div
        className="fixed z-[70] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-5 w-[320px]"
        style={{ top: tipTop, left: tipLeft }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 mb-1">
          Step {step + 1} of {steps.length}
        </p>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1.5">
          {current?.title}
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
          {current?.body}
        </p>
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={skip}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
          >
            Skip tour
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="secondary" size="sm" onClick={prev}>
                Back
              </Button>
            )}
            <Button size="sm" onClick={next}>
              {step === steps.length - 1 ? "Finish" : "Next"}
            </Button>
          </div>
        </div>
      </div>

      <div
        className="fixed z-[71]"
        style={{ top: mTop, left: mLeft, width: MASCOT_W, height: MASCOT_H }}
      >
        <TourMascot />
      </div>
    </div>
  );
}
