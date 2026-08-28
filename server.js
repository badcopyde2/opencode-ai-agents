const path = require('path');
const express = require('express');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'data.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS machines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'defekt', 'ausser_betrieb')),
    fill_level INTEGER NOT NULL DEFAULT 100 CHECK (fill_level BETWEEN 0 AND 100),
    notes TEXT DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const countRow = db.prepare('SELECT COUNT(*) AS c FROM machines').get();
if (countRow.c === 0) {
  const seed = db.prepare(`
    INSERT INTO machines (name, address, lat, lng, status, fill_level, notes)
    VALUES (@name, @address, @lat, @lng, @status, @fill_level, @notes)
  `);
  const seedData = [
    { name: 'Automat Hauptbahnhof', address: 'Bahnhofsplatz 1, Musterstadt', lat: 52.5200, lng: 13.4050, status: 'ok', fill_level: 85, notes: '' },
    { name: 'Automat Marktplatz', address: 'Marktplatz 3, Musterstadt', lat: 52.5170, lng: 13.3888, status: 'ok', fill_level: 40, notes: 'Bald nachfüllen' },
    { name: 'Automat Kneipe Zur Post', address: 'Poststraße 12, Musterstadt', lat: 52.5230, lng: 13.4110, status: 'defekt', fill_level: 10, notes: 'Kartenleser defekt' },
    { name: 'Automat Tankstelle Nord', address: 'Nordring 5, Musterstadt', lat: 52.5300, lng: 13.3950, status: 'ausser_betrieb', fill_level: 0, notes: 'Wird abgebaut' },
  ];
  const insertMany = db.transaction((rows) => rows.forEach((r) => seed.run(r)));
  insertMany(seedData);
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
// Leaflet lokal ausliefern, damit die App ohne CDN/Internetzugang läuft
app.use('/vendor/leaflet', express.static(path.join(__dirname, 'node_modules', 'leaflet', 'dist')));

const VALID_STATUS = ['ok', 'defekt', 'ausser_betrieb'];

function validateMachinePayload(body, { partial = false } = {}) {
  const errors = [];
  const out = {};

  if (!partial || body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim() === '') errors.push('name ist erforderlich');
    else out.name = body.name.trim();
  }
  if (!partial || body.address !== undefined) {
    if (typeof body.address !== 'string' || body.address.trim() === '') errors.push('address ist erforderlich');
    else out.address = body.address.trim();
  }
  if (!partial || body.lat !== undefined) {
    const lat = Number(body.lat);
    if (Number.isNaN(lat) || lat < -90 || lat > 90) errors.push('lat muss zwischen -90 und 90 liegen');
    else out.lat = lat;
  }
  if (!partial || body.lng !== undefined) {
    const lng = Number(body.lng);
    if (Number.isNaN(lng) || lng < -180 || lng > 180) errors.push('lng muss zwischen -180 und 180 liegen');
    else out.lng = lng;
  }
  if (!partial || body.status !== undefined) {
    if (!VALID_STATUS.includes(body.status)) errors.push(`status muss einer von ${VALID_STATUS.join(', ')} sein`);
    else out.status = body.status;
  }
  if (!partial || body.fill_level !== undefined) {
    const fl = Number(body.fill_level);
    if (Number.isNaN(fl) || fl < 0 || fl > 100) errors.push('fill_level muss zwischen 0 und 100 liegen');
    else out.fill_level = Math.round(fl);
  }
  if (body.notes !== undefined) {
    out.notes = String(body.notes);
  }

  return { errors, data: out };
}

app.get('/api/machines', (req, res) => {
  const rows = db.prepare('SELECT * FROM machines ORDER BY id').all();
  res.json(rows);
});

app.get('/api/machines/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM machines WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Automat nicht gefunden' });
  res.json(row);
});

app.post('/api/machines', (req, res) => {
  const { errors, data } = validateMachinePayload(req.body, { partial: false });
  if (errors.length) return res.status(400).json({ errors });

  const stmt = db.prepare(`
    INSERT INTO machines (name, address, lat, lng, status, fill_level, notes)
    VALUES (@name, @address, @lat, @lng, @status, @fill_level, @notes)
  `);
  const info = stmt.run({ ...data, notes: data.notes ?? '' });
  const created = db.prepare('SELECT * FROM machines WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(created);
});

app.put('/api/machines/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM machines WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Automat nicht gefunden' });

  const { errors, data } = validateMachinePayload(req.body, { partial: true });
  if (errors.length) return res.status(400).json({ errors });
  if (Object.keys(data).length === 0) return res.status(400).json({ errors: ['Keine gültigen Felder übergeben'] });

  const merged = { ...existing, ...data };
  db.prepare(`
    UPDATE machines
    SET name = @name, address = @address, lat = @lat, lng = @lng,
        status = @status, fill_level = @fill_level, notes = @notes,
        updated_at = datetime('now')
    WHERE id = @id
  `).run(merged);

  const updated = db.prepare('SELECT * FROM machines WHERE id = ?').get(req.params.id);
  res.json(updated);
});

app.delete('/api/machines/:id', (req, res) => {
  const info = db.prepare('DELETE FROM machines WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Automat nicht gefunden' });
  res.status(204).end();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Zigarettenautomat-Map läuft auf http://localhost:${PORT}`);
});
