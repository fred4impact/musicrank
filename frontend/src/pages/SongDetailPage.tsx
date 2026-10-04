import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getSong, submitVote } from "../lib/api";
import { useFetch } from "../lib/useFetch";
import { RatingBadge } from "../components/RatingBadge";
import { StarRating } from "../components/StarRating";

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function SongDetailPage() {
  const { id } = useParams<{ id: string }>();
  const songId = Number(id);
  const [refreshKey, setRefreshKey] = useState(0);
  const [voteState, setVoteState] = useState<"idle" | "submitting" | "error" | "done">("idle");
  const [voteError, setVoteError] = useState<string | null>(null);

  const song = useFetch(() => getSong(songId), [songId, refreshKey]);

  async function handleRate(rating: number) {
    setVoteState("submitting");
    setVoteError(null);
    try {
      await submitVote(songId, rating);
      setVoteState("done");
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setVoteState("error");
      setVoteError(err instanceof Error ? err.message : "Could not submit your vote.");
    }
  }

  if (song.status === "loading") return <p className="text-zinc-500">Loading…</p>;
  if (song.status === "error") return <p className="text-red-400">{song.message}</p>;

  const data = song.data;

  return (
    <div className="flex flex-col gap-6">
      <Link to="/songs" className="text-sm text-zinc-400 hover:text-zinc-200">
        ← Back to songs
      </Link>

      <div className="flex flex-col gap-2">
        {data.genre && (
          <span className="w-fit rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
            {data.genre.name}
          </span>
        )}
        <h1 className="text-3xl font-semibold text-zinc-50">{data.title}</h1>
        <Link to={`/artists/${data.artist.id}`} className="text-zinc-400 hover:text-zinc-200">
          {data.artist.name}
        </Link>
        <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-zinc-500 sm:grid-cols-3">
          {data.album && (
            <div>
              <dt className="text-zinc-600">Album</dt>
              <dd className="text-zinc-300">{data.album}</dd>
            </div>
          )}
          <div>
            <dt className="text-zinc-600">Duration</dt>
            <dd className="text-zinc-300">{formatDuration(data.durationSeconds)}</dd>
          </div>
          {data.releaseDate && (
            <div>
              <dt className="text-zinc-600">Released</dt>
              <dd className="text-zinc-300">{new Date(data.releaseDate).getFullYear()}</dd>
            </div>
          )}
        </dl>
      </div>

      <RatingBadge rating={data.rating} votes={data.votes} />

      <div className="flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
        <p className="text-sm text-zinc-400">
          {voteState === "done"
            ? "Thanks — your vote is queued. The rating above updates once it's processed (usually instant)."
            : "Rate this song"}
        </p>
        <StarRating disabled={voteState === "submitting"} onRate={handleRate} />
        {voteState === "error" && <p className="text-sm text-red-400">{voteError}</p>}
      </div>
    </div>
  );
}
