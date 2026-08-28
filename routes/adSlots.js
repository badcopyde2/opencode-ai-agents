const express = require('express');
const db = require('../db');
const { validateAdSlot } = require('../validation');

const router = express.Router();

const SELECT_SLOTS = `
  SELECT a.*, m.name AS machine_name, m.address AS machine_address
  FROM ad_slots a
  JOIN machines m ON m.id = a.machine_id
`;

const findById = db.prepare(`${SELECT_SLOTS} WHERE a.id = ?`);

// Bei freien Flächen bleiben Werbepartner, Kampagne und Laufzeit leer, egal was der Client schickt.
function clearWhenVacant(row) {
  if (row.status !== 'frei') return row;
  return { ...row, advertiser: '', campaign: '', start_date: null, end_date: null };
}

router.get('/', (req, res) => {
  const { status, machine_id: machineId } = req.query;
  const conditions = [];
  const params = {};

  if (status) {
    conditions.push('a.status = @status');
    params.status = status;
  }
  if (machineId) {
    conditions.push('a.machine_id = @machineId');
    params.machineId = machineId;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  res.json(db.prepare(`${SELECT_SLOTS} ${where} ORDER BY a.machine_id, a.id`).all(params));
});

router.get('/:id', (req, res) => {
  const slot = findById.get(req.params.id);
  if (!slot) return res.status(404).json({ error: 'Werbefläche nicht gefunden' });
  res.json(slot);
});

router.post('/', (req, res) => {
  const { errors, data } = validateAdSlot(req.body, { partial: false });
  if (errors.length) return res.status(400).json({ errors });

  const machine = db.prepare('SELECT 1 FROM machines WHERE id = ?').get(data.machine_id);
  if (!machine) return res.status(400).json({ errors: ['Automat existiert nicht'] });

  const row = clearWhenVacant({
    advertiser: '', campaign: '', notes: '', start_date: null, end_date: null, ...data,
  });

  const info = db.prepare(`
    INSERT INTO ad_slots (machine_id, position, width_cm, height_cm, status,
                          advertiser, campaign, price_per_month, start_date, end_date, notes)
    VALUES (@machine_id, @position, @width_cm, @height_cm, @status,
            @advertiser, @campaign, @price_per_month, @start_date, @end_date, @notes)
  `).run(row);

  res.status(201).json(findById.get(info.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM ad_slots WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Werbefläche nicht gefunden' });

  const { errors, data } = validateAdSlot(req.body, { partial: true });
  if (errors.length) return res.status(400).json({ errors });
  if (Object.keys(data).length === 0) return res.status(400).json({ errors: ['Keine gültigen Felder übergeben'] });

  if (data.machine_id && !db.prepare('SELECT 1 FROM machines WHERE id = ?').get(data.machine_id)) {
    return res.status(400).json({ errors: ['Automat existiert nicht'] });
  }

  db.prepare(`
    UPDATE ad_slots
    SET machine_id = @machine_id, position = @position, width_cm = @width_cm, height_cm = @height_cm,
        status = @status, advertiser = @advertiser, campaign = @campaign,
        price_per_month = @price_per_month, start_date = @start_date, end_date = @end_date,
        notes = @notes, updated_at = datetime('now')
    WHERE id = @id
  `).run(clearWhenVacant({ ...existing, ...data }));

  res.json(findById.get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM ad_slots WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Werbefläche nicht gefunden' });
  res.status(204).end();
});

module.exports = router;
