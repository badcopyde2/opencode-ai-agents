/* Dashboard: Kennzahlen, Anteilsbalken, Befüllstand-Diagramm und Tabellen. */
const Dashboard = (() => {
  const { escapeHtml, formatEuro, formatPercent, formatDate, fillTone, chip, machineChip, slotChip, api } = App;

  let stats = null;
  let slots = [];

  function statTile({ label, value, sub }) {
    return `
      <div class="card">
        <div class="stat-label">${escapeHtml(label)}</div>
        <div class="stat-value">${escapeHtml(value)}</div>
        <div class="stat-sub">${sub || ''}</div>
      </div>
    `;
  }

  function renderKpis() {
    const m = stats.machines;
    const a = stats.adSlots;
    const criticalSub = m.criticalCount > 0
      ? chip({ tone: 'critical', glyph: '!', label: `${m.criticalCount} kritisch` })
      : chip({ tone: 'good', glyph: '✓', label: 'nichts kritisch' });

    document.getElementById('kpi-row').innerHTML = [
      statTile({
        label: 'Automaten',
        value: String(m.total),
        sub: `${m.byStatus.ok} aktiv · ${m.byStatus.defekt} defekt`,
      }),
      statTile({
        label: 'Ø Befüllstand',
        value: formatPercent(m.avgFill, 1),
        sub: criticalSub,
      }),
      statTile({
        label: 'Werbeflächen belegt',
        value: formatPercent(a.occupancyRate),
        sub: `${a.byStatus.belegt} von ${a.total} Flächen`,
      }),
      statTile({
        label: 'Werbeumsatz / Monat',
        value: formatEuro(a.monthlyRevenue),
        sub: `${formatEuro(a.vacantPotential)} liegen in freien Flächen brach`,
      }),
    ].join('');
  }

  // Ein gestapelter Anteilsbalken. Die Zahlen stehen in der Legende, nicht im Balken –
  // schmale Segmente könnten ein Label sonst abschneiden.
  function renderStack(stackEl, legendEl, segments) {
    const total = segments.reduce((sum, s) => sum + s.count, 0);
    stackEl.innerHTML = total === 0
      ? ''
      : segments
        .filter((s) => s.count > 0)
        .map((s) => `<div class="stack-seg" style="width:${(s.count / total) * 100}%;background:${s.color};" title="${escapeHtml(s.label)}: ${s.count}"></div>`)
        .join('');

    legendEl.innerHTML = segments.map((s) => `
      <span class="legend-item">
        <span class="legend-swatch" style="background:${s.color}"></span>
        ${escapeHtml(s.label)}
        <span class="legend-count">${s.count}</span>
      </span>
    `).join('');
  }

  function renderMachineStatus() {
    const s = stats.machines.byStatus;
    document.getElementById('machine-status-sub').textContent = `${stats.machines.total} Automaten insgesamt`;
    renderStack(
      document.getElementById('machine-status-stack'),
      document.getElementById('machine-status-legend'),
      [
        { label: 'OK', count: s.ok, color: 'var(--status-good)' },
        { label: 'Defekt', count: s.defekt, color: 'var(--status-critical)' },
        { label: 'Außer Betrieb', count: s.ausser_betrieb, color: 'var(--text-muted)' },
      ]
    );
  }

  function renderAdStatus() {
    const s = stats.adSlots.byStatus;
    document.getElementById('ad-status-sub').textContent =
      `${stats.adSlots.total} Flächen · ${formatEuro(stats.adSlots.monthlyRevenue)} laufender Monatsumsatz`;
    renderStack(
      document.getElementById('ad-status-stack'),
      document.getElementById('ad-status-legend'),
      [
        { label: 'Belegt', count: s.belegt, color: 'var(--series-1)' },
        { label: 'Reserviert', count: s.reserviert, color: 'var(--series-2)' },
        { label: 'Frei', count: s.frei, color: 'var(--text-muted)' },
      ]
    );
  }

  // Balkenlänge trägt die Menge, der Chip daneben den Zustand – Farbe allein
  // müsste sonst zwei Dinge gleichzeitig ausdrücken.
  function renderFillChart() {
    const rows = stats.machines.fillLevels;
    document.getElementById('fill-chart').innerHTML = rows.map((m) => {
      const tone = fillTone(m.fill_level);
      const outOfService = m.status === 'ausser_betrieb';
      return `
        <div class="bar-row" title="${escapeHtml(m.name)}: ${formatPercent(m.fill_level)}">
          <span class="bar-label">${escapeHtml(m.name)}</span>
          <div class="bar-track">
            <div class="bar-fill" style="width:${m.fill_level}%;${outOfService ? 'background:var(--text-muted);' : ''}"></div>
          </div>
          <span class="bar-value">${formatPercent(m.fill_level)}</span>
          ${outOfService ? chip(App.MACHINE_STATUS.ausser_betrieb) : chip(tone)}
        </div>
      `;
    }).join('');

    document.getElementById('fill-table').innerHTML = `
      <table class="data">
        <thead><tr><th>Automat</th><th>Status</th><th style="text-align:right">Befüllstand</th></tr></thead>
        <tbody>
          ${rows.map((m) => `
            <tr>
              <td class="strong">${escapeHtml(m.name)}</td>
              <td>${machineChip(m.status)}</td>
              <td class="num">${formatPercent(m.fill_level)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  function renderRefill() {
    const rows = stats.machines.refillNeeded;
    document.getElementById('refill-sub').textContent =
      `Unter ${stats.thresholds.low} % Befüllstand · außer Betrieb genommene Automaten bleiben außen vor`;

    const target = document.getElementById('refill-table');
    if (!rows.length) {
      target.innerHTML = '<p class="empty-state">Kein Automat muss aktuell nachgefüllt werden.</p>';
      return;
    }
    target.innerHTML = `
      <table class="data">
        <thead><tr><th>Automat</th><th>Adresse</th><th>Dringlichkeit</th><th style="text-align:right">Stand</th></tr></thead>
        <tbody>
          ${rows.map((m) => `
            <tr>
              <td class="strong">${escapeHtml(m.name)}</td>
              <td>${escapeHtml(m.address)}</td>
              <td>${chip(fillTone(m.fill_level))}</td>
              <td class="num">${formatPercent(m.fill_level)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  function renderExpiring() {
    const rows = stats.adSlots.expiringSoon;
    const expired = stats.adSlots.expired;
    document.getElementById('expiring-sub').textContent =
      `Laufen in den nächsten ${stats.thresholds.expiryWindowDays} Tagen aus`;

    const target = document.getElementById('expiring-table');
    const expiredNote = expired.length
      ? `<p class="empty-state">${expired.length} Vertrag/Verträge sind bereits abgelaufen, die Fläche steht aber noch auf belegt.</p>`
      : '';

    if (!rows.length) {
      target.innerHTML = `<p class="empty-state">Kein Vertrag läuft demnächst aus.</p>${expiredNote}`;
      return;
    }
    target.innerHTML = `
      <table class="data">
        <thead><tr><th>Werbepartner</th><th>Automat</th><th>Läuft aus</th><th style="text-align:right">Tage</th><th style="text-align:right">€/Monat</th></tr></thead>
        <tbody>
          ${rows.map((s) => `
            <tr>
              <td class="strong">${escapeHtml(s.advertiser || 'ohne Partner')}</td>
              <td>${escapeHtml(s.machine_name)}</td>
              <td>${formatDate(s.end_date)}</td>
              <td class="num">${s.days_left}</td>
              <td class="num">${formatEuro(s.price_per_month)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>${expiredNote}
    `;
  }

  function renderSlotsTable() {
    document.getElementById('slots-sub').textContent =
      `${slots.length} Flächen an ${stats.machines.total} Automaten`;

    const target = document.getElementById('slots-table');
    if (!slots.length) {
      target.innerHTML = '<p class="empty-state">Noch keine Werbeflächen angelegt.</p>';
      return;
    }
    target.innerHTML = `
      <table class="data">
        <thead>
          <tr>
            <th>Automat</th><th>Position</th><th>Größe</th><th>Status</th>
            <th>Werbepartner</th><th>Kampagne</th><th>Laufzeit</th><th style="text-align:right">€/Monat</th>
          </tr>
        </thead>
        <tbody>
          ${slots.map((s) => `
            <tr>
              <td class="strong">${escapeHtml(s.machine_name)}</td>
              <td>${escapeHtml(App.SLOT_POSITION[s.position] || s.position)}</td>
              <td>${s.width_cm}×${s.height_cm} cm</td>
              <td>${slotChip(s.status)}</td>
              <td>${escapeHtml(s.advertiser || '–')}</td>
              <td>${escapeHtml(s.campaign || '–')}</td>
              <td>${s.start_date || s.end_date ? `${formatDate(s.start_date)} – ${formatDate(s.end_date)}` : '–'}</td>
              <td class="num">${formatEuro(s.price_per_month)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  async function refresh() {
    [stats, slots] = await Promise.all([api('/api/stats'), api('/api/ad-slots')]);
    renderKpis();
    renderMachineStatus();
    renderAdStatus();
    renderFillChart();
    renderRefill();
    renderExpiring();
    renderSlotsTable();
  }

  // Jedes Diagramm hat eine Tabellenansicht als barrierefreies Gegenstück.
  document.querySelectorAll('.table-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const panel = document.getElementById(btn.dataset.toggle);
      const nowHidden = panel.classList.toggle('hidden');
      btn.textContent = nowHidden ? 'Als Tabelle anzeigen' : 'Tabelle ausblenden';
    });
  });

  return { refresh };
})();
