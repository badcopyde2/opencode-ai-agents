/* Gemeinsame Helfer und Beschriftungen für Dashboard und Karte. */
const App = (() => {
  const MACHINE_STATUS = {
    ok: { label: 'OK', glyph: '✓', tone: 'good' },
    defekt: { label: 'Defekt', glyph: '!', tone: 'critical' },
    ausser_betrieb: { label: 'Außer Betrieb', glyph: '×', tone: 'neutral' },
  };

  const SLOT_STATUS = {
    belegt: { label: 'Belegt', glyph: '●', tone: 'series-1' },
    reserviert: { label: 'Reserviert', glyph: '◐', tone: 'series-2' },
    frei: { label: 'Frei', glyph: '○', tone: 'neutral' },
  };

  const SLOT_POSITION = { vorne: 'Vorne', links: 'Links', rechts: 'Rechts', oben: 'Oben' };

  // Befüllstand ist ein Zustand, kein Rang: unter 20 % kritisch, unter 50 % nachfüllen.
  function fillTone(level) {
    if (level < 20) return { tone: 'critical', glyph: '!', label: 'Kritisch' };
    if (level < 50) return { tone: 'warning', glyph: '↓', label: 'Nachfüllen' };
    return { tone: 'good', glyph: '✓', label: 'OK' };
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[c]);
  }

  function formatEuro(value) {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
    }).format(value ?? 0);
  }

  // Im Deutschen mit Komma und geschütztem Leerzeichen vor dem Prozentzeichen.
  function formatPercent(value, decimals = 0) {
    return `${new Intl.NumberFormat('de-DE', {
      minimumFractionDigits: 0, maximumFractionDigits: decimals,
    }).format(value ?? 0)} %`;
  }

  function formatDate(value) {
    if (!value) return '–';
    // SQLite liefert "YYYY-MM-DD HH:MM:SS" in UTC, Datumsfelder nur "YYYY-MM-DD".
    const iso = value.includes(' ') ? `${value.replace(' ', 'T')}Z` : `${value}T00:00:00Z`;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '–';
    return value.includes(' ')
      ? date.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })
      : date.toLocaleDateString('de-DE', { dateStyle: 'medium' });
  }

  // Statuschip: Farbe wird immer von Symbol und Text begleitet, damit sie nie
  // allein die Bedeutung trägt (Rot und Grün sind bei Rotgrünblindheit fast gleich).
  function chip({ tone, glyph, label }) {
    return `<span class="chip"><span class="glyph ${tone}" aria-hidden="true">${glyph}</span>${escapeHtml(label)}</span>`;
  }

  function machineChip(status) {
    return chip(MACHINE_STATUS[status] || MACHINE_STATUS.ok);
  }

  function slotChip(status) {
    return chip(SLOT_STATUS[status] || SLOT_STATUS.frei);
  }

  async function api(path, options = {}) {
    const res = await fetch(path, {
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
      ...options,
    });
    if (res.status === 204) return null;
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(payload.error || 'Anfrage fehlgeschlagen');
      err.fieldErrors = payload.errors || (payload.error ? [payload.error] : ['Unbekannter Fehler']);
      throw err;
    }
    return payload;
  }

  function showErrors(container, messages) {
    if (!messages || !messages.length) {
      container.classList.add('hidden');
      container.innerHTML = '';
      return;
    }
    container.classList.remove('hidden');
    container.innerHTML = `<ul>${messages.map((m) => `<li>${escapeHtml(m)}</li>`).join('')}</ul>`;
  }

  return {
    MACHINE_STATUS, SLOT_STATUS, SLOT_POSITION,
    fillTone, escapeHtml, formatEuro, formatPercent, formatDate,
    chip, machineChip, slotChip, api, showErrors,
  };
})();
