-- MusicRank initial schema
-- users.id is a client-generated UUID (anonymous voting, no auth in V1 — see spec §25/§26).
-- Other entities use plain serial IDs, matching the spec's own example payloads (songId: 123, etc).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE genres (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE artists (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE songs (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  artist_id INTEGER NOT NULL REFERENCES artists(id),
  genre_id INTEGER REFERENCES genres(id),
  album TEXT,
  release_date DATE,
  duration_seconds INTEGER,
  cover_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_songs_artist_id ON songs(artist_id);
CREATE INDEX idx_songs_genre_id ON songs(genre_id);

-- Anonymous client identity: the frontend generates this UUID on first visit
-- (localStorage) and sends it as userId with every vote. No login in V1.
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE votes (
  id SERIAL PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES users(id),
  song_id INTEGER NOT NULL REFERENCES songs(id),
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, song_id)
);

CREATE INDEX idx_votes_song_id ON votes(song_id);
CREATE INDEX idx_votes_user_id ON votes(user_id);

CREATE TABLE song_statistics (
  song_id INTEGER PRIMARY KEY REFERENCES songs(id),
  vote_count INTEGER NOT NULL DEFAULT 0,
  average_rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  ranking_score NUMERIC(6,3) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
