import { Link } from "react-router-dom";
import type { RankingEntry } from "../lib/types";

export function RankingList({ entries }: { entries: RankingEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-zinc-500">No ranked songs yet — be the first to vote.</p>;
  }

  return (
    <ol className="flex flex-col divide-y divide-zinc-800 rounded-lg border border-zinc-800">
      {entries.map((entry) => (
        <li key={entry.songId}>
          <Link
            to={`/songs/${entry.songId}`}
            className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-zinc-900/60"
          >
            <span className="w-6 shrink-0 text-right text-sm text-zinc-500">{entry.position}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-zinc-50">{entry.title}</p>
              <p className="truncate text-sm text-zinc-400">{entry.artist}</p>
            </div>
            <div className="shrink-0 text-right text-sm">
              <p className="text-amber-400">{entry.score.toFixed(2)}</p>
              <p className="text-zinc-500">{entry.votes} votes</p>
            </div>
          </Link>
        </li>
      ))}
    </ol>
  );
}
