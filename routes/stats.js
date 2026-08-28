const express = require('express');
const db = require('../db');

const router = express.Router();

// Ab diesen Werten gilt ein Automat als nachfüllbedürftig bzw. kritisch.
const FILL_CRITICAL = 20;
const FILL_LOW = 50;
const EXPIRY_WINDOW_DAYS = 60;

function countBy(rows, key) {
  return rows.reduce((acc, row) => {
    acc[row[key]] = (acc[row[key]] || 0) + 1;
    return acc;
  }, {});
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

router.get('/', (req, res) => {
  const machines = db.prepare('SELECT * FROM machines ORDER BY id').all();
  const slots = db.prepare(`
    SELECT a.*, m.name AS machine_name
    FROM ad_slots a JOIN machines m ON m.id = a.machine_id
    ORDER BY a.id
  `).all();

  const machineStatus = countBy(machines, 'status');
  const slotStatus = countBy(slots, 'status');

  // "Außer Betrieb" zählt nicht mit: da ist ein leerer Automat kein Problem.
  const active = machines.filter((m) => m.status !== 'ausser_betrieb');
  const avgFill = active.length
    ? round2(active.reduce((sum, m) => sum + m.fill_level, 0) / active.length)
    : 0;

  const refillNeeded = active
    .filter((m) => m.fill_level < FILL_LOW)
    .sort((a, b) => a.fill_level - b.fill_level)
    .map((m) => ({
      id: m.id,
      name: m.name,
      address: m.address,
      fill_level: m.fill_level,
      severity: m.fill_level < FILL_CRITICAL ? 'kritisch' : 'niedrig',
    }));

  const occupied = slots.filter((s) => s.status === 'belegt');
  const monthlyRevenue = round2(occupied.reduce((sum, s) => sum + s.price_per_month, 0));
  const vacantPotential = round2(
    slots.filter((s) => s.status === 'frei').reduce((sum, s) => sum + s.price_per_month, 0)
  );

  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date(Date.now() + EXPIRY_WINDOW_DAYS * 86400000).toISOString().slice(0, 10);
  const expiringSoon = slots
    .filter((s) => s.end_date && s.end_date >= today && s.end_date <= horizon)
    .sort((a, b) => a.end_date.localeCompare(b.end_date))
    .map((s) => ({
      id: s.id,
      machine_id: s.machine_id,
      machine_name: s.machine_name,
      advertiser: s.advertiser,
      campaign: s.campaign,
      end_date: s.end_date,
      price_per_month: s.price_per_month,
      days_left: Math.round((new Date(`${s.end_date}T00:00:00Z`) - new Date(`${today}T00:00:00Z`)) / 86400000),
    }));

  const expired = slots
    .filter((s) => s.status !== 'frei' && s.end_date && s.end_date < today)
    .map((s) => ({
      id: s.id,
      machine_name: s.machine_name,
      advertiser: s.advertiser,
      end_date: s.end_date,
    }));

  res.json({
    machines: {
      total: machines.length,
      byStatus: {
        ok: machineStatus.ok || 0,
        defekt: machineStatus.defekt || 0,
        ausser_betrieb: machineStatus.ausser_betrieb || 0,
      },
      avgFill,
      refillNeeded,
      criticalCount: refillNeeded.filter((m) => m.severity === 'kritisch').length,
      fillLevels: machines
        .map((m) => ({ id: m.id, name: m.name, fill_level: m.fill_level, status: m.status }))
        .sort((a, b) => a.fill_level - b.fill_level),
    },
    adSlots: {
      total: slots.length,
      byStatus: {
        frei: slotStatus.frei || 0,
        belegt: slotStatus.belegt || 0,
        reserviert: slotStatus.reserviert || 0,
      },
      occupancyRate: slots.length ? Math.round((occupied.length / slots.length) * 100) : 0,
      monthlyRevenue,
      vacantPotential,
      expiringSoon,
      expired,
    },
    thresholds: { critical: FILL_CRITICAL, low: FILL_LOW, expiryWindowDays: EXPIRY_WINDOW_DAYS },
  });
});

module.exports = router;
