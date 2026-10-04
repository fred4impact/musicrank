import { Link, useParams } from "react-router-dom";
import { getArtist } from "../lib/api";
import { useFetch } from "../lib/useFetch";

export function ArtistPage() {
  const { id } = useParams<{ id: string }>();
  const artist = useFetch(() => getArtist(Number(id)), [id]);

  if (artist.status === "loading") return <p className="text-zinc-500">Loading…</p>;
  if (artist.status === "error") return <p className="text-red-400">{artist.message}</p>;

  const data = artist.data;

  return (
    <div className="flex flex-col gap-6">
      <Link to="/songs" className="text-sm text-zinc-400 hover:text-zinc-200">
        ← Back to songs
      </Link>
      <h1 className="text-3xl font-semibold text-zinc-50">{data.name}</h1>

      <ol className="flex flex-col divide-y divide-zinc-800 rounded-lg border border-zinc-800">
        {data.songs.map((song) => (
          <li key={song.id}>
            <Link
              to={`/songs/${song.id}`}
              className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-zinc-900/60"
            >
              <span className="text-zinc-100">{song.title}</span>
              <span className="text-sm text-zinc-500">
                {song.votes > 0 ? `★ ${song.rating.toFixed(1)}` : "No votes yet"}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
