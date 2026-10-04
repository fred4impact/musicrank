import { Link } from "react-router-dom";
import { getGlobalRanking } from "../lib/api";
import { useFetch } from "../lib/useFetch";
import { RankingList } from "../components/RankingList";

export function HomePage() {
  const topRanked = useFetch(() => getGlobalRanking(5), []);

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">
          Rate the songs that matter to you.
        </h1>
        <p className="max-w-xl text-zinc-400">
          MusicRank is a community-ranked catalogue — vote 1 to 5 stars on any song, and watch the rankings
          update as everyone else weighs in.
        </p>
        <div className="mt-2 flex gap-3">
          <Link
            to="/songs"
            className="rounded-md bg-amber-400 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-amber-300"
          >
            Browse songs
          </Link>
          <Link
            to="/rankings"
            className="rounded-md border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-500"
          >
            View rankings
          </Link>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-50">Top ranked</h2>
          <Link to="/rankings" className="text-sm text-zinc-400 hover:text-zinc-200">
            See all →
          </Link>
        </div>
        {topRanked.status === "loading" && <p className="text-zinc-500">Loading…</p>}
        {topRanked.status === "error" && <p className="text-red-400">{topRanked.message}</p>}
        {topRanked.status === "success" && <RankingList entries={topRanked.data.ranking} />}
      </section>
    </div>
  );
}
