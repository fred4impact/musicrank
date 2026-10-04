export function RatingBadge({ rating, votes }: { rating: number; votes: number }) {
  return (
    <div className="flex items-center gap-1.5 text-sm text-zinc-400">
      <span className="text-amber-400">★</span>
      <span className="text-zinc-200">{votes > 0 ? rating.toFixed(1) : "—"}</span>
      <span>
        ({votes} {votes === 1 ? "vote" : "votes"})
      </span>
    </div>
  );
}
