import projectImage from "../../project-image.png";

interface TourMascotProps {
  /** Diameter of the mascot avatar in pixels. */
  size?: number;
  /** Optional name shown on the mascot's badge. */
  name?: string;
}

/**
 * The tour "teacher" mascot, built from the project image. It floats gently
 * and acts as the friendly guide that presents each tour step.
 */
export default function TourMascot({
  size = 78,
  name = "Ruca",
}: TourMascotProps) {
  return (
    <div className="flex flex-col items-center select-none">
      <div
        className="animate-mascot rounded-2xl bg-white dark:bg-slate-700 p-1 shadow-xl ring-2 ring-blue-400"
        style={{ width: size, height: size }}
      >
        <img
          src={projectImage}
          alt={`${name}, your TPM-RCA guide`}
          className="w-full h-full object-contain rounded-xl"
          draggable={false}
        />
      </div>
      <span className="mt-1 text-[10px] font-semibold text-white bg-blue-600 rounded-full px-2 py-0.5 shadow">
        {name}
      </span>
    </div>
  );
}
