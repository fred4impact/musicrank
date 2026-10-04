import { Route, Routes } from "react-router-dom";
import { Header } from "./components/Header";
import { HomePage } from "./pages/HomePage";
import { SongListPage } from "./pages/SongListPage";
import { SongDetailPage } from "./pages/SongDetailPage";
import { ArtistPage } from "./pages/ArtistPage";
import { RankingsPage } from "./pages/RankingsPage";

export function App() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Header />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/songs" element={<SongListPage />} />
          <Route path="/songs/:id" element={<SongDetailPage />} />
          <Route path="/artists/:id" element={<ArtistPage />} />
          <Route path="/rankings" element={<RankingsPage />} />
        </Routes>
      </main>
    </div>
  );
}
