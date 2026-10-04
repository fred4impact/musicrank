import { getClientId } from "./clientId";
import type { ApiError, ArtistDetail, Genre, RankingEntry, SongSummary } from "./types";

const VOTE_API_URL = import.meta.env.VITE_VOTE_API_URL ?? "http://localhost:4001";
const RANKING_API_URL = import.meta.env.VITE_RANKING_API_URL ?? "http://localhost:4002";

export class ApiRequestError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
  }
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    throw new ApiRequestError(
      body?.error.code ?? "UNKNOWN_ERROR",
      body?.error.message ?? `Request to ${url} failed with status ${res.status}`
    );
  }
  return res.json() as Promise<T>;
}

export function getGlobalRanking(limit = 20): Promise<{ ranking: RankingEntry[] }> {
  return getJson(`${RANKING_API_URL}/api/v1/rankings/global?limit=${limit}`);
}

export function getTrendingRanking(limit = 10): Promise<{ ranking: RankingEntry[] }> {
  return getJson(`${RANKING_API_URL}/api/v1/rankings/trending?limit=${limit}`);
}

export function getSongs(params: { genre?: string; limit?: number } = {}): Promise<{ songs: SongSummary[] }> {
  const query = new URLSearchParams();
  if (params.genre) query.set("genre", params.genre);
  query.set("limit", String(params.limit ?? 50));
  return getJson(`${RANKING_API_URL}/api/v1/songs?${query}`);
}

export function getSong(id: number): Promise<SongSummary> {
  return getJson(`${RANKING_API_URL}/api/v1/songs/${id}`);
}

export function getArtist(id: number): Promise<ArtistDetail> {
  return getJson(`${RANKING_API_URL}/api/v1/artists/${id}`);
}

export function getGenres(): Promise<{ genres: Genre[] }> {
  return getJson(`${RANKING_API_URL}/api/v1/genres`);
}

export async function submitVote(songId: number, rating: number): Promise<void> {
  const res = await fetch(`${VOTE_API_URL}/api/v1/votes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ songId, rating, userId: getClientId() }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    throw new ApiRequestError(
      body?.error.code ?? "UNKNOWN_ERROR",
      body?.error.message ?? "Could not submit your vote. Please try again."
    );
  }
}
