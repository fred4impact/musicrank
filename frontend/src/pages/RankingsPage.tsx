import { useState } from "react";
import { getGlobalRanking, getTrendingRanking } from "../lib/api";
import { useFetch } from "../lib/useFetch";
import { RankingList } from "../components/RankingList";

const TABS = [
  { key: "global", label: "Global" },
  { key: "trending", label: "Trending" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function RankingsPage() {
  const [tab, setTab] = useState<TabKey>("global");
  const ranking = useFetch(
    () => (tab === "global" ? getGlobalRanking(50) : getTrendingRanking(50)),
    [tab]
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-zinc-50">Rankings</h1>

      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.key ? "bg-amber-400 text-zinc-900" : "border border-zinc-700 text-zinc-300 hover:border-zinc-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "trending" && (
        <p className="text-sm text-zinc-500">Based on votes received in the last 24 hours.</p>
      )}

      {ranking.status === "loading" && <p className="text-zinc-500">Loading…</p>}
      {ranking.status === "error" && <p className="text-red-400">{ranking.message}</p>}
      {ranking.status === "success" && <RankingList entries={ranking.data.ranking} />}
    </div>
  );
}
