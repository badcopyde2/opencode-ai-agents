const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, 'data.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

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

  CREATE TABLE IF NOT EXISTS ad_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id INTEGER NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    position TEXT NOT NULL CHECK (position IN ('vorne', 'links', 'rechts', 'oben')),
    width_cm INTEGER NOT NULL DEFAULT 40,
    height_cm INTEGER NOT NULL DEFAULT 30,
    status TEXT NOT NULL DEFAULT 'frei' CHECK (status IN ('frei', 'belegt', 'reserviert')),
    advertiser TEXT NOT NULL DEFAULT '',
    campaign TEXT NOT NULL DEFAULT '',
    price_per_month REAL NOT NULL DEFAULT 0,
    start_date TEXT,
    end_date TEXT,
    notes TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_ad_slots_machine ON ad_slots(machine_id);
`);

function seedIfEmpty() {
  if (db.prepare('SELECT COUNT(*) AS c FROM machines').get().c > 0) return;

  const insertMachine = db.prepare(`
    INSERT INTO machines (name, address, lat, lng, status, fill_level, notes)
    VALUES (@name, @address, @lat, @lng, @status, @fill_level, @notes)
  `);
  const insertSlot = db.prepare(`
    INSERT INTO ad_slots (machine_id, position, width_cm, height_cm, status,
                          advertiser, campaign, price_per_month, start_date, end_date, notes)
    VALUES (@machine_id, @position, @width_cm, @height_cm, @status,
            @advertiser, @campaign, @price_per_month, @start_date, @end_date, @notes)
  `);

  const machines = [
    {
      machine: { name: 'Automat Hauptbahnhof', address: 'Bahnhofsplatz 1, Musterstadt', lat: 52.5200, lng: 13.4050, status: 'ok', fill_level: 85, notes: '' },
      slots: [
        { position: 'vorne', width_cm: 60, height_cm: 40, status: 'belegt', advertiser: 'Cafe Milano', campaign: 'Frühstücksangebot', price_per_month: 120, start_date: '2026-01-01', end_date: '2026-12-31', notes: '' },
        { position: 'links', width_cm: 40, height_cm: 30, status: 'belegt', advertiser: 'Taxi Müller', campaign: 'Flughafentransfer', price_per_month: 80, start_date: '2026-03-01', end_date: '2026-09-30', notes: '' },
        { position: 'rechts', width_cm: 40, height_cm: 30, status: 'frei', advertiser: '', campaign: '', price_per_month: 80, start_date: null, end_date: null, notes: '' },
      ],
    },
    {
      machine: { name: 'Automat Marktplatz', address: 'Marktplatz 3, Musterstadt', lat: 52.5170, lng: 13.3888, status: 'ok', fill_level: 40, notes: 'Bald nachfüllen' },
      slots: [
        { position: 'vorne', width_cm: 60, height_cm: 40, status: 'belegt', advertiser: 'Fitness Zone', campaign: 'Herbstaktion', price_per_month: 150, start_date: '2026-06-01', end_date: '2026-09-15', notes: 'Verlängerung angefragt' },
        { position: 'oben', width_cm: 60, height_cm: 20, status: 'reserviert', advertiser: 'Pizzeria Bella', campaign: 'Lieferservice', price_per_month: 60, start_date: '2026-10-01', end_date: '2027-03-31', notes: 'Motiv fehlt noch' },
      ],
    },
    {
      machine: { name: 'Automat Kneipe Zur Post', address: 'Poststraße 12, Musterstadt', lat: 52.5230, lng: 13.4110, status: 'defekt', fill_level: 10, notes: 'Kartenleser defekt' },
      slots: [
        { position: 'vorne', width_cm: 60, height_cm: 40, status: 'belegt', advertiser: 'Brauhaus Alt', campaign: 'Hausmarke', price_per_month: 90, start_date: '2026-02-01', end_date: '2026-09-10', notes: '' },
        { position: 'links', width_cm: 40, height_cm: 30, status: 'frei', advertiser: '', campaign: '', price_per_month: 70, start_date: null, end_date: null, notes: '' },
      ],
    },
    {
      machine: { name: 'Automat Tankstelle Nord', address: 'Nordring 5, Musterstadt', lat: 52.5300, lng: 13.3950, status: 'ausser_betrieb', fill_level: 0, notes: 'Wird abgebaut' },
      slots: [
        { position: 'vorne', width_cm: 60, height_cm: 40, status: 'frei', advertiser: '', campaign: '', price_per_month: 100, start_date: null, end_date: null, notes: 'Standort wird aufgegeben' },
      ],
    },
    {
      machine: { name: 'Automat Kiosk Südpark', address: 'Parkallee 44, Musterstadt', lat: 52.5105, lng: 13.4180, status: 'ok', fill_level: 18, notes: '' },
      slots: [
        { position: 'vorne', width_cm: 60, height_cm: 40, status: 'belegt', advertiser: 'Autohaus Berg', campaign: 'Jahreswagen', price_per_month: 140, start_date: '2026-04-01', end_date: '2026-09-20', notes: '' },
        { position: 'rechts', width_cm: 40, height_cm: 30, status: 'frei', advertiser: '', campaign: '', price_per_month: 75, start_date: null, end_date: null, notes: '' },
        { position: 'oben', width_cm: 60, height_cm: 20, status: 'frei', advertiser: '', campaign: '', price_per_month: 55, start_date: null, end_date: null, notes: '' },
      ],
    },
  ];

  db.transaction(() => {
    machines.forEach(({ machine, slots }) => {
      const info = insertMachine.run(machine);
      slots.forEach((slot) => insertSlot.run({ ...slot, machine_id: info.lastInsertRowid }));
    });
  })();
}

seedIfEmpty();

module.exports = db;
