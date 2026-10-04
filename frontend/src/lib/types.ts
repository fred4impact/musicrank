export type RankingEntry = {
  position: number;
  songId: number;
  title: string;
  artist: string;
  score: number;
  votes: number;
};

export type SongSummary = {
  id: number;
  title: string;
  album: string | null;
  releaseDate: string | null;
  durationSeconds: number | null;
  coverImageUrl: string | null;
  artist: { id: number; name: string };
  genre: { id: number; name: string } | null;
  rating: number;
  votes: number;
};

export type ArtistDetail = {
  id: number;
  name: string;
  songs: { id: number; title: string; rating: number; votes: number }[];
};

export type Genre = { id: number; name: string };

export type ApiError = { error: { code: string; message: string } };
