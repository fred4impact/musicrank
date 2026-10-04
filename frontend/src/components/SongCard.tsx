import { Link } from "react-router-dom";
import type { SongSummary } from "../lib/types";
import { RatingBadge } from "./RatingBadge";

export function SongCard({ song }: { song: SongSummary }) {
  return (
    <Link
      to={`/songs/${song.id}`}
      className="flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 transition-colors hover:border-zinc-600"
    >
      <div className="flex items-center justify-between gap-2">
        {song.genre && (
          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">{song.genre.name}</span>
        )}
      </div>
      <h3 className="font-medium text-zinc-50">{song.title}</h3>
      <p className="text-sm text-zinc-400">{song.artist.name}</p>
      <RatingBadge rating={song.rating} votes={song.votes} />
    </Link>
  );
}
