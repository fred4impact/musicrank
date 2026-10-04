-- Fictional placeholder catalogue for local development/demo.
-- Titles/artists are made up on purpose — avoids any real-rights-holder
-- association in a public portfolio repo (see spec non-goals: no copyrighted
-- music, no streaming). cover_image_url is left NULL until a media story exists.

INSERT INTO genres (name) VALUES
  ('Rock'), ('Pop'), ('Electronic'), ('Hip-Hop'), ('Jazz'), ('Indie')
ON CONFLICT (name) DO NOTHING;

INSERT INTO artists (name) VALUES
  ('The Faded Signals'),
  ('Nova Ember'),
  ('Glass Hollow'),
  ('Marcus Reign'),
  ('Paper Tide'),
  ('The Low Static'),
  ('Kira Vance'),
  ('Orbit & Rust');

-- seq + ORDER BY makes song id assignment deterministic — without it, the
-- JOIN below is free to reorder rows and song ids wouldn't reliably match
-- this list across environments.
INSERT INTO songs (title, artist_id, genre_id, album, release_date, duration_seconds)
SELECT s.title, a.id, g.id, s.album, s.release_date::date, s.duration_seconds
FROM (VALUES
  (1, 'Midnight Frequency', 'The Faded Signals', 'Rock', 'Static Lines', '2023-03-14', 214),
  (2, 'Reckless Weather', 'The Faded Signals', 'Rock', 'Static Lines', '2023-03-14', 198),
  (3, 'Golden Hour Again', 'Nova Ember', 'Pop', 'Afterglow', '2024-06-02', 187),
  (4, 'Paper Hearts', 'Nova Ember', 'Pop', 'Afterglow', '2024-06-02', 203),
  (5, 'Hollow Bloom', 'Glass Hollow', 'Indie', 'Slow Rooms', '2022-11-09', 241),
  (6, 'Quiet Static', 'Glass Hollow', 'Indie', 'Slow Rooms', '2022-11-09', 229),
  (7, 'Night Circuit', 'Marcus Reign', 'Hip-Hop', 'Reign Supreme', '2025-01-20', 176),
  (8, 'No Ceiling', 'Marcus Reign', 'Hip-Hop', 'Reign Supreme', '2025-01-20', 192),
  (9, 'Low Tide Letters', 'Paper Tide', 'Indie', 'Shoreline', '2023-08-30', 220),
  (10, 'Washed Out', 'Paper Tide', 'Indie', 'Shoreline', '2023-08-30', 205),
  (11, 'Static Bloom', 'The Low Static', 'Electronic', 'Interference', '2024-02-17', 256),
  (12, 'Pulse Drive', 'The Low Static', 'Electronic', 'Interference', '2024-02-17', 234),
  (13, 'Velvet Smoke', 'Kira Vance', 'Jazz', 'After Dark', '2021-09-05', 263),
  (14, 'Blue Room', 'Kira Vance', 'Jazz', 'After Dark', '2021-09-05', 247),
  (15, 'Satellite Heart', 'Orbit & Rust', 'Electronic', 'Drift', '2025-04-11', 211),
  (16, 'Gravity Well', 'Orbit & Rust', 'Electronic', 'Drift', '2025-04-11', 198),
  (17, 'Faded Polaroid', 'Nova Ember', 'Pop', 'Afterglow', '2024-06-02', 179),
  (18, 'Rust Belt Romance', 'The Faded Signals', 'Rock', 'Static Lines', '2023-03-14', 225),
  (19, 'Counting Streetlights', 'Paper Tide', 'Indie', 'Shoreline', '2023-08-30', 212),
  (20, 'Afterimage', 'Glass Hollow', 'Indie', 'Slow Rooms', '2022-11-09', 233)
) AS s(seq, title, artist_name, genre_name, album, release_date, duration_seconds)
JOIN artists a ON a.name = s.artist_name
JOIN genres g ON g.name = s.genre_name
ORDER BY s.seq;

INSERT INTO song_statistics (song_id, vote_count, average_rating, ranking_score)
SELECT id, 0, 0, 0 FROM songs
ON CONFLICT (song_id) DO NOTHING;
