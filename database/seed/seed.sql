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

INSERT INTO songs (title, artist_id, genre_id, album, release_date, duration_seconds)
SELECT s.title, a.id, g.id, s.album, s.release_date::date, s.duration_seconds
FROM (VALUES
  ('Midnight Frequency', 'The Faded Signals', 'Rock', 'Static Lines', '2023-03-14', 214),
  ('Reckless Weather', 'The Faded Signals', 'Rock', 'Static Lines', '2023-03-14', 198),
  ('Golden Hour Again', 'Nova Ember', 'Pop', 'Afterglow', '2024-06-02', 187),
  ('Paper Hearts', 'Nova Ember', 'Pop', 'Afterglow', '2024-06-02', 203),
  ('Hollow Bloom', 'Glass Hollow', 'Indie', 'Slow Rooms', '2022-11-09', 241),
  ('Quiet Static', 'Glass Hollow', 'Indie', 'Slow Rooms', '2022-11-09', 229),
  ('Night Circuit', 'Marcus Reign', 'Hip-Hop', 'Reign Supreme', '2025-01-20', 176),
  ('No Ceiling', 'Marcus Reign', 'Hip-Hop', 'Reign Supreme', '2025-01-20', 192),
  ('Low Tide Letters', 'Paper Tide', 'Indie', 'Shoreline', '2023-08-30', 220),
  ('Washed Out', 'Paper Tide', 'Indie', 'Shoreline', '2023-08-30', 205),
  ('Static Bloom', 'The Low Static', 'Electronic', 'Interference', '2024-02-17', 256),
  ('Pulse Drive', 'The Low Static', 'Electronic', 'Interference', '2024-02-17', 234),
  ('Velvet Smoke', 'Kira Vance', 'Jazz', 'After Dark', '2021-09-05', 263),
  ('Blue Room', 'Kira Vance', 'Jazz', 'After Dark', '2021-09-05', 247),
  ('Satellite Heart', 'Orbit & Rust', 'Electronic', 'Drift', '2025-04-11', 211),
  ('Gravity Well', 'Orbit & Rust', 'Electronic', 'Drift', '2025-04-11', 198),
  ('Faded Polaroid', 'Nova Ember', 'Pop', 'Afterglow', '2024-06-02', 179),
  ('Rust Belt Romance', 'The Faded Signals', 'Rock', 'Static Lines', '2023-03-14', 225),
  ('Counting Streetlights', 'Paper Tide', 'Indie', 'Shoreline', '2023-08-30', 212),
  ('Afterimage', 'Glass Hollow', 'Indie', 'Slow Rooms', '2022-11-09', 233)
) AS s(title, artist_name, genre_name, album, release_date, duration_seconds)
JOIN artists a ON a.name = s.artist_name
JOIN genres g ON g.name = s.genre_name;

INSERT INTO song_statistics (song_id, vote_count, average_rating, ranking_score)
SELECT id, 0, 0, 0 FROM songs
ON CONFLICT (song_id) DO NOTHING;
