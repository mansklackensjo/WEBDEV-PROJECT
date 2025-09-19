PRAGMA foreign_keys = OFF;
BEGIN TRANSACTION;

-- Drop old tables if they exist
DROP TABLE IF EXISTS movies;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;

-- USERS (5 records)
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','admin')),
  created_at TEXT DEFAULT (datetime('now'))
);

INSERT INTO users (username, password_hash, role) VALUES
-- admin (password: wdf#2025)
('admin', '$2b$10$9IYiSykTu9JcOq0KoxD.6.wwng/u9vam2RXopTuUbMiBYuqJsMW2i', 'admin'),
-- users (password: user1234)
('jane',  '$2b$10$CUd95CeHxsKZlFHsELeNiuE0MZ5fwadwC4Ok.8tBq9nK4gNz72Jlu', 'user'),
('john',  '$2b$10$CUd95CeHxsKZlFHsELeNiuE0MZ5fwadwC4Ok.8tBq9nK4gNz72Jlu', 'user'),
('emma',  '$2b$10$CUd95CeHxsKZlFHsELeNiuE0MZ5fwadwC4Ok.8tBq9nK4gNz72Jlu', 'user'),
('li',    '$2b$10$CUd95CeHxsKZlFHsELeNiuE0MZ5fwadwC4Ok.8tBq9nK4gNz72Jlu', 'user');

-- CATEGORIES (5 records)
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);

INSERT INTO categories (name) VALUES
('Action'),
('Drama'),
('Comedy'),
('Sci-Fi'),
('Horror');

-- MOVIES (10 records, linked to categories and users)
CREATE TABLE movies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  synopsis TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 10),
  category_id INTEGER NOT NULL,
  poster_path TEXT,
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO movies (title, synopsis, rating, category_id, poster_path, created_by) VALUES
('Steel Horizon',     'A veteran pilot faces one last impossible mission.', 8,
 (SELECT id FROM categories WHERE name='Action'), '/uploads/movie1.jpg',  (SELECT id FROM users WHERE username='admin')),
('Crimson Alley',     'A detective confronts his past while chasing a killer.', 7,
 (SELECT id FROM categories WHERE name='Action'), '/uploads/movie2.jpg',  (SELECT id FROM users WHERE username='admin')),
('Echoes of Winter',  'Two siblings reunite after years apart.', 8,
 (SELECT id FROM categories WHERE name='Drama'),  '/uploads/movie3.jpg',  (SELECT id FROM users WHERE username='jane')),
('Paper Moons',       'A writer finds truth in unfinished letters.', 7,
 (SELECT id FROM categories WHERE name='Drama'),  '/uploads/movie4.jpg',  (SELECT id FROM users WHERE username='jane')),
('Late Checkout',     'A hotel night manager solves quirky guest problems.', 6,
 (SELECT id FROM categories WHERE name='Comedy'), '/uploads/movie5.jpg',  (SELECT id FROM users WHERE username='john')),
('Weekend at Nora’s', 'Friends plan the perfect surprise gone wrong.', 7,
 (SELECT id FROM categories WHERE name='Comedy'), '/uploads/movie6.jpg',  (SELECT id FROM users WHERE username='emma')),
('Blue Parade',       'A small town rallies for a fading tradition.', 9,
 (SELECT id FROM categories WHERE name='Drama'),  '/uploads/movie7.jpg',  (SELECT id FROM users WHERE username='li')),
('Rooftop Runner',    'A courier races across a neon city.', 6,
 (SELECT id FROM categories WHERE name='Action'), '/uploads/movie8.jpg',  (SELECT id FROM users WHERE username='john')),
('Orbital Drift',     'A stranded crew must improvise to survive in orbit.', 8,
 (SELECT id FROM categories WHERE name='Sci-Fi'), '/uploads/movie9.jpg',  (SELECT id FROM users WHERE username='emma')),
('Night Whispers',    'A group of friends confronts their darkest fears.', 7,
 (SELECT id FROM categories WHERE name='Horror'), '/uploads/movie10.jpg', (SELECT id FROM users WHERE username='li'));

COMMIT;
PRAGMA foreign_keys = ON;
