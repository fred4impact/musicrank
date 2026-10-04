import { useState } from "react";

const STARS = [1, 2, 3, 4, 5];

export function StarRating({
  disabled,
  onRate,
}: {
  disabled?: boolean;
  onRate: (rating: number) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Rate this song">
      {STARS.map((star) => {
        const filled = hovered !== null ? star <= hovered : false;
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={false}
            aria-label={`${star} star${star > 1 ? "s" : ""}`}
            disabled={disabled}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onRate(star)}
            className="text-3xl leading-none transition-transform disabled:cursor-not-allowed disabled:opacity-50 enabled:hover:scale-110"
          >
            <span className={filled ? "text-amber-400" : "text-zinc-600"}>★</span>
          </button>
        );
      })}
    </div>
  );
}
