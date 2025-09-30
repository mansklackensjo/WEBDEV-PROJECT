// app.js
const express = require('express');
const exphbs  = require('express-handlebars');
const path    = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt  = require('bcrypt');
const session = require('express-session');
const multer  = require('multer');

const app  = express();
const db   = new sqlite3.Database(path.join(__dirname, 'data.db'));
const port = 8080;

// -------- Middlewares
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'mini-secret',
  resave: false,
  saveUninitialized: false
}));

// -------- View engine
app.engine('hbs', exphbs.engine({
  extname: '.hbs',
  defaultLayout: 'main',
  layoutsDir: path.join(__dirname, 'views', 'layouts'),
  helpers: {
    eq: (a, b) => a === b,
    times: (n, block) => { let s=''; for (let i=1;i<=n;i++) s += block.fn(i); return s; }
  }
}));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// -------- Small helpers
const all = (sql, params=[]) => new Promise((res,rej)=>db.all(sql, params, (e,rows)=>e?rej(e):res(rows)));
const get = (sql, params=[]) => new Promise((res,rej)=>db.get(sql, params, (e,row)=>e?rej(e):res(row)));
const run = (sql, params=[]) => new Promise((res,rej)=>db.run(sql, params, function(e){e?rej(e):res(this);} ));

function requireAuth(req,res,next){ if(!req.session.user) return res.redirect('/login'); next(); }
function requireAdmin(req,res,next){ if(!req.session.user || req.session.user.role!=='admin') return res.status(403).send('Forbidden'); next(); }

// -------- Upload (movie posters)
const upload = multer({ dest: 'uploads/' });

// ==================================================
// Routes
// ==================================================

// Home -> Movies (page 1)
app.get('/', (req,res)=> res.redirect('/movies?page=1'));

// About / Contact
app.get('/about',   (req,res)=> res.render('static/about',   { user: req.session.user }));
app.get('/contact', (req,res)=> res.render('static/contact', { user: req.session.user }));

// ---------- Movies: list (3 per page)
app.get('/movies', async (req,res) => {
  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const limit = 3;
  const offset = (page - 1) * limit;

  const categories = await all(`SELECT id, name FROM categories ORDER BY name`);
  const selectedCategoryId = parseInt(req.query.category_id || req.query.category || '', 10);
  const hasFilter = Number.isInteger(selectedCategoryId) && selectedCategoryId > 0;

  const whereSql = hasFilter ? 'WHERE m.category_id = ?' : '';
  const listParams = hasFilter ? [selectedCategoryId, limit, offset] : [limit, offset];
  const countParams = hasFilter ? [selectedCategoryId] : [];

  const movies = await all(
    `SELECT m.id, m.title, m.synopsis, m.rating, m.poster_path, c.name AS category
     FROM movies m
     JOIN categories c ON c.id = m.category_id
     ${whereSql}
     ORDER BY m.id DESC
     LIMIT ? OFFSET ?`, listParams
  );

  const { c: total } = await get(
    `SELECT COUNT(*) AS c FROM movies m ${whereSql}`, countParams
  );
  const totalPages = Math.max(Math.ceil(total / limit), 1);

  res.render('movies/index', {
    user: req.session.user,
    movies, page, totalPages,
    categories,
    selectedCategoryId: hasFilter ? selectedCategoryId : ''
  });
});

// ---------- Movies: create (form + submit) [auth]
app.get('/movies/new', requireAuth, async (req,res)=>{
  const categories = await all(`SELECT id, name FROM categories ORDER BY name`);
  res.render('movies/new', { user: req.session.user, categories });
});

// ---------- Movies: detail
app.get('/movies/:id', async (req,res) => {
  const movie = await get(`
    SELECT m.*, c.name AS category
    FROM movies m
    JOIN categories c ON c.id = m.category_id
    WHERE m.id = ?`, [req.params.id]);

  if(!movie) return res.status(404).send('Not found');
  res.render('movies/show', { user: req.session.user, movie });
});

app.post('/movies', requireAuth, upload.single('poster'), async (req,res)=>{
  const { title, synopsis, rating, category_id } = req.body;
  const poster_path = req.file ? `/uploads/${req.file.filename}` : null;
  await run(
    `INSERT INTO movies (title, synopsis, rating, category_id, poster_path, created_by)
     VALUES (?,?,?,?,?,?)`,
    [title, synopsis, parseInt(rating,10), parseInt(category_id,10), poster_path, req.session.user.id]
  );
  res.redirect('/movies?page=1');
});

// ---------- Movies: edit (form + submit) [auth]
app.get('/movies/:id/edit', requireAuth, async (req,res)=>{
  const [movie, categories] = await Promise.all([
    get(`SELECT * FROM movies WHERE id=?`, [req.params.id]),
    all(`SELECT id,name FROM categories ORDER BY name`)
  ]);
  if(!movie) return res.status(404).send('Not found');
  res.render('movies/edit', { user: req.session.user, movie, categories });
});

app.post('/movies/:id/edit', requireAuth, upload.single('poster'), async (req,res)=>{
  const { title, synopsis, rating, category_id } = req.body;
  const existing = await get(`SELECT poster_path FROM movies WHERE id=?`, [req.params.id]);
  const poster_path = req.file ? `/uploads/${req.file.filename}` : existing?.poster_path || null;

  await run(
    `UPDATE movies
     SET title=?, synopsis=?, rating=?, category_id=?, poster_path=?
     WHERE id=?`,
    [title, synopsis, parseInt(rating,10), parseInt(category_id,10), poster_path, req.params.id]
  );
  res.redirect(`/movies/${req.params.id}`);
});

// ---------- Movies: delete [auth]
app.post('/movies/:id/delete', requireAuth, async (req,res)=>{
  await run(`DELETE FROM movies WHERE id=?`, [req.params.id]);
  res.redirect('/movies?page=1');
});

// ---------- Auth
app.get('/login', (req,res)=> res.render('auth/login', { user: req.session.user }));

app.post('/login', async (req,res)=>{
  const { username, password } = req.body;
  const u = await get(`SELECT * FROM users WHERE username=?`, [username]);
  if(!u) return res.render('auth/login', { error: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, u.password_hash);
  if(!ok) return res.render('auth/login', { error: 'Invalid credentials' });

  req.session.user = { id: u.id, username: u.username, role: u.role };
  res.redirect('/movies?page=1');
});

app.post('/logout', (req,res)=> {
  req.session.destroy(()=> res.redirect('/movies?page=1'));
});

// ---------- Admin: users list (expand later to full CRUD)
app.get('/admin/users', requireAdmin, async (req,res)=>{
  const users = await all(`SELECT id, username, role, created_at FROM users ORDER BY id DESC`);
  res.render('admin/users/index', { user: req.session.user, users });
});

// ---------- Admin: create user
app.get('/admin/users/new', requireAdmin, (req,res)=>{
  res.render('admin/users/new', { user: req.session.user });
});

app.post('/admin/users', requireAdmin, async (req,res)=>{
  try {
    const { username, password, role } = req.body;
    if(!username || !password || !role) {
      return res.render('admin/users/new', { user: req.session.user, error: 'All fields are required', form: { username, role } });
    }
    if(!(role === 'admin' || role === 'user')) {
      return res.render('admin/users/new', { user: req.session.user, error: 'Role must be admin or user', form: { username, role } });
    }
    const hash = await bcrypt.hash(password, 10);
    await run(`INSERT INTO users (username, password_hash, role) VALUES (?,?,?)`, [username, hash, role]);
    res.redirect('/admin/users');
  } catch (e) {
    const msg = e && e.message && e.message.includes('UNIQUE') ? 'Username already exists' : 'Failed to create user';
    res.render('admin/users/new', { user: req.session.user, error: msg, form: { username: req.body.username, role: req.body.role } });
  }
});

// ---------- Admin: edit user
app.get('/admin/users/:id/edit', requireAdmin, async (req,res)=>{
  const u = await get(`SELECT id, username, role FROM users WHERE id=?`, [req.params.id]);
  if(!u) return res.status(404).send('Not found');
  res.render('admin/users/edit', { user: req.session.user, u });
});

app.post('/admin/users/:id/edit', requireAdmin, async (req,res)=>{
  try {
    const { username, role, password } = req.body;
    if(!(role === 'admin' || role === 'user')) {
      const u = await get(`SELECT id, username, role FROM users WHERE id=?`, [req.params.id]);
      return res.render('admin/users/edit', { user: req.session.user, u, error: 'Role must be admin or user' });
    }

    // Update username and role
    await run(`UPDATE users SET username=?, role=? WHERE id=?`, [username, role, req.params.id]);

    // Optional password change
    if(password && password.trim().length > 0) {
      const hash = await bcrypt.hash(password, 10);
      await run(`UPDATE users SET password_hash=? WHERE id=?`, [hash, req.params.id]);
    }

    // If the edited user is the current session user, update their session role/username
    if(req.session.user && String(req.session.user.id) === String(req.params.id)) {
      req.session.user.username = username;
      req.session.user.role = role;
    }

    res.redirect('/admin/users');
  } catch (e) {
    const u = await get(`SELECT id, username, role FROM users WHERE id=?`, [req.params.id]);
    const msg = e && e.message && e.message.includes('UNIQUE') ? 'Username already exists' : 'Failed to update user';
    res.render('admin/users/edit', { user: req.session.user, u, error: msg });
  }
});

// ---------- Admin: delete user
app.post('/admin/users/:id/delete', requireAdmin, async (req,res)=>{
  // Prevent deleting your own account
  if(req.session.user && String(req.session.user.id) === String(req.params.id)) {
    return res.status(400).send('Cannot delete your own account');
  }
  await run(`DELETE FROM users WHERE id=?`, [req.params.id]);
  res.redirect('/admin/users');
});

// ==================================================
app.listen(port, ()=> {
  console.log(`Server running: http://localhost:${port}`);
});
