const MACHINE_STATUS = ['ok', 'defekt', 'ausser_betrieb'];
const AD_SLOT_STATUS = ['frei', 'belegt', 'reserviert'];
const AD_SLOT_POSITIONS = ['vorne', 'links', 'rechts', 'oben'];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value) {
  if (!DATE_PATTERN.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

// Sammelt Feldfehler, damit das Formular alle Probleme auf einmal anzeigen kann.
class FieldChecker {
  constructor(body, partial) {
    this.body = body;
    this.partial = partial;
    this.errors = [];
    this.data = {};
  }

  // Ein Feld wird geprüft, wenn es ein Vollupdate ist oder der Client es mitgeschickt hat.
  applies(field) {
    return !this.partial || this.body[field] !== undefined;
  }

  text(field, label, { required = true } = {}) {
    if (!this.applies(field)) return this;
    const value = this.body[field];
    if (typeof value !== 'string' || (required && value.trim() === '')) {
      this.errors.push(`${label} ist erforderlich`);
    } else {
      this.data[field] = value.trim();
    }
    return this;
  }

  optionalText(field) {
    if (this.body[field] !== undefined) this.data[field] = String(this.body[field]).trim();
    return this;
  }

  number(field, label, { min, max, integer = false } = {}) {
    if (!this.applies(field)) return this;
    const value = Number(this.body[field]);
    if (!Number.isFinite(value) || value < min || value > max) {
      this.errors.push(`${label} muss zwischen ${min} und ${max} liegen`);
    } else {
      this.data[field] = integer ? Math.round(value) : value;
    }
    return this;
  }

  id(field, label) {
    if (!this.applies(field)) return this;
    const value = Number(this.body[field]);
    if (!Number.isInteger(value) || value < 1) {
      this.errors.push(`${label} ist erforderlich`);
    } else {
      this.data[field] = value;
    }
    return this;
  }

  oneOf(field, label, allowed) {
    if (!this.applies(field)) return this;
    if (!allowed.includes(this.body[field])) {
      this.errors.push(`${label} muss einer von ${allowed.join(', ')} sein`);
    } else {
      this.data[field] = this.body[field];
    }
    return this;
  }

  // Leerer String und null bedeuten "kein Datum gesetzt".
  optionalDate(field, label) {
    if (this.body[field] === undefined) return this;
    const value = this.body[field];
    if (value === null || value === '') {
      this.data[field] = null;
    } else if (typeof value !== 'string' || !isValidDate(value)) {
      this.errors.push(`${label} muss ein Datum im Format JJJJ-MM-TT sein`);
    } else {
      this.data[field] = value;
    }
    return this;
  }

  result() {
    return { errors: this.errors, data: this.data };
  }
}

function validateMachine(body, { partial = false } = {}) {
  return new FieldChecker(body, partial)
    .text('name', 'Name')
    .text('address', 'Adresse')
    .number('lat', 'Breitengrad', { min: -90, max: 90 })
    .number('lng', 'Längengrad', { min: -180, max: 180 })
    .oneOf('status', 'Status', MACHINE_STATUS)
    .number('fill_level', 'Befüllstand', { min: 0, max: 100, integer: true })
    .optionalText('notes')
    .result();
}

function validateAdSlot(body, { partial = false } = {}) {
  const checker = new FieldChecker(body, partial)
    .id('machine_id', 'Automat')
    .oneOf('position', 'Position', AD_SLOT_POSITIONS)
    .number('width_cm', 'Breite', { min: 1, max: 1000, integer: true })
    .number('height_cm', 'Höhe', { min: 1, max: 1000, integer: true })
    .oneOf('status', 'Status', AD_SLOT_STATUS)
    .number('price_per_month', 'Monatspreis', { min: 0, max: 1000000 })
    .optionalText('advertiser')
    .optionalText('campaign')
    .optionalText('notes')
    .optionalDate('start_date', 'Startdatum')
    .optionalDate('end_date', 'Enddatum');

  const { errors, data } = checker.result();

  if (data.start_date && data.end_date && data.end_date < data.start_date) {
    errors.push('Enddatum darf nicht vor dem Startdatum liegen');
  }
  if (data.status === 'belegt' && data.advertiser !== undefined && data.advertiser === '') {
    errors.push('Bei Status "belegt" ist ein Werbepartner erforderlich');
  }

  return { errors, data };
}

module.exports = {
  MACHINE_STATUS,
  AD_SLOT_STATUS,
  AD_SLOT_POSITIONS,
  validateMachine,
  validateAdSlot,
};
