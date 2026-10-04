import { useSearchParams } from "react-router-dom";
import { getGenres, getSongs } from "../lib/api";
import { useFetch } from "../lib/useFetch";
import { SongCard } from "../components/SongCard";

export function SongListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const genre = searchParams.get("genre") ?? "";

  const genres = useFetch(() => getGenres(), []);
  const songs = useFetch(() => getSongs({ genre: genre || undefined }), [genre]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-zinc-50">Songs</h1>
        {genres.status === "success" && (
          <select
            value={genre}
            onChange={(e) => {
              const next = e.target.value;
              setSearchParams(next ? { genre: next } : {});
            }}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200"
          >
            <option value="">All genres</option>
            {genres.data.genres.map((g) => (
              <option key={g.id} value={g.name}>
                {g.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {songs.status === "loading" && <p className="text-zinc-500">Loading…</p>}
      {songs.status === "error" && <p className="text-red-400">{songs.message}</p>}
      {songs.status === "success" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {songs.data.songs.map((song) => (
            <SongCard key={song.id} song={song} />
          ))}
        </div>
      )}
    </div>
  );
}
