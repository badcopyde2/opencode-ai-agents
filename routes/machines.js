const express = require('express');
const db = require('../db');
const { validateMachine } = require('../validation');

const router = express.Router();

// Die Werbeflächen-Zähler hängen mit an, damit Karte und Liste sie ohne Zusatzabfrage zeigen können.
const SELECT_MACHINES = `
  SELECT m.*,
         COUNT(a.id) AS ad_slots_total,
         COALESCE(SUM(CASE WHEN a.status = 'belegt' THEN 1 ELSE 0 END), 0) AS ad_slots_occupied,
         COALESCE(SUM(CASE WHEN a.status = 'belegt' THEN a.price_per_month ELSE 0 END), 0) AS ad_revenue_monthly
  FROM machines m
  LEFT JOIN ad_slots a ON a.machine_id = m.id
`;

const findById = db.prepare(`${SELECT_MACHINES} WHERE m.id = ? GROUP BY m.id`);

router.get('/', (req, res) => {
  res.json(db.prepare(`${SELECT_MACHINES} GROUP BY m.id ORDER BY m.id`).all());
});

router.get('/:id', (req, res) => {
  const machine = findById.get(req.params.id);
  if (!machine) return res.status(404).json({ error: 'Automat nicht gefunden' });
  res.json(machine);
});

router.get('/:id/ad-slots', (req, res) => {
  const exists = db.prepare('SELECT 1 FROM machines WHERE id = ?').get(req.params.id);
  if (!exists) return res.status(404).json({ error: 'Automat nicht gefunden' });
  res.json(db.prepare('SELECT * FROM ad_slots WHERE machine_id = ? ORDER BY id').all(req.params.id));
});

router.post('/', (req, res) => {
  const { errors, data } = validateMachine(req.body, { partial: false });
  if (errors.length) return res.status(400).json({ errors });

  const info = db.prepare(`
    INSERT INTO machines (name, address, lat, lng, status, fill_level, notes)
    VALUES (@name, @address, @lat, @lng, @status, @fill_level, @notes)
  `).run({ ...data, notes: data.notes ?? '' });

  res.status(201).json(findById.get(info.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM machines WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Automat nicht gefunden' });

  const { errors, data } = validateMachine(req.body, { partial: true });
  if (errors.length) return res.status(400).json({ errors });
  if (Object.keys(data).length === 0) return res.status(400).json({ errors: ['Keine gültigen Felder übergeben'] });

  db.prepare(`
    UPDATE machines
    SET name = @name, address = @address, lat = @lat, lng = @lng,
        status = @status, fill_level = @fill_level, notes = @notes,
        updated_at = datetime('now')
    WHERE id = @id
  `).run({ ...existing, ...data });

  res.json(findById.get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM machines WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Automat nicht gefunden' });
  res.status(204).end();
});

module.exports = router;
