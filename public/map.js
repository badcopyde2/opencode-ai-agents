/* Kartenansicht: Marker, Seitenliste und Statusfilter. */
const MapView = (() => {
  const { escapeHtml, formatEuro, formatPercent, formatDate, fillTone, chip, machineChip, api } = App;

  const map = L.map('map').setView([52.52, 13.405], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap-Mitwirkende',
    maxZoom: 19,
  }).addTo(map);

  const markersById = new Map();
  let machines = [];
  let onEdit = () => {};

  // Der Marker trägt Farbe UND Symbol: defekte und leere Automaten sind so auch
  // dann unterscheidbar, wenn Rot und Grün gleich aussehen.
  function markerAppearance(machine) {
    if (machine.status === 'defekt') return { color: 'var(--status-critical)', glyph: '!' };
    if (machine.status === 'ausser_betrieb') return { color: 'var(--text-muted)', glyph: '×' };
    const tone = fillTone(machine.fill_level);
    return {
      color: `var(--status-${tone.tone})`,
      glyph: tone.tone === 'good' ? '✓' : tone.glyph,
      dark: tone.tone === 'warning',
    };
  }

  function makeIcon(machine) {
    const { color, glyph, dark } = markerAppearance(machine);
    return L.divIcon({
      className: '',
      html: `<div style="width:20px;height:20px;border-radius:50%;background:${color};
                    border:2px solid #fcfcfb;box-shadow:0 0 3px rgba(0,0,0,0.45);
                    display:flex;align-items:center;justify-content:center;
                    color:${dark ? '#0b0b0b' : '#fff'};font-size:11px;font-weight:700;line-height:1;"
                  >${glyph}</div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
  }

  function popupHtml(machine) {
    const adLine = machine.ad_slots_total > 0
      ? `${machine.ad_slots_occupied} von ${machine.ad_slots_total} Werbeflächen belegt · ${formatEuro(machine.ad_revenue_monthly)}/Monat`
      : 'Keine Werbeflächen angelegt';

    return `
      <div class="popup-content">
        <h3>${escapeHtml(machine.name)}</h3>
        <div class="muted">${escapeHtml(machine.address)}</div>
        <div class="row-line">${machineChip(machine.status)}</div>
        <div class="row-line">
          ${chip({ ...fillTone(machine.fill_level), label: `Befüllstand ${formatPercent(machine.fill_level)}` })}
        </div>
        <div class="muted" style="margin-top:0.35rem;">${escapeHtml(adLine)}</div>
        ${machine.notes ? `<div class="muted" style="margin-top:0.35rem;">📝 ${escapeHtml(machine.notes)}</div>` : ''}
        <div class="muted" style="margin-top:0.35rem;">Stand: ${formatDate(machine.updated_at)}</div>
        <div class="popup-actions">
          <button type="button" class="btn-secondary btn-small" data-edit-id="${machine.id}">Bearbeiten</button>
        </div>
      </div>
    `;
  }

  function activeStatuses() {
    return [...document.querySelectorAll('.filter-status:checked')].map((c) => c.value);
  }

  function visibleMachines() {
    const active = activeStatuses();
    return machines.filter((m) => active.includes(m.status));
  }

  function renderMarkers() {
    markersById.forEach((marker) => map.removeLayer(marker));
    markersById.clear();

    visibleMachines().forEach((machine) => {
      const marker = L.marker([machine.lat, machine.lng], {
        icon: makeIcon(machine),
        title: `${machine.name} — ${App.MACHINE_STATUS[machine.status].label}, ${formatPercent(machine.fill_level)}`,
      }).addTo(map).bindPopup(popupHtml(machine));

      marker.on('popupopen', () => {
        const btn = document.querySelector(`[data-edit-id="${machine.id}"]`);
        if (btn) btn.addEventListener('click', () => onEdit(machine));
      });
      markersById.set(machine.id, marker);
    });
  }

  function renderList() {
    const list = document.getElementById('machine-list');
    list.innerHTML = '';

    visibleMachines().forEach((machine) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="m-name">${escapeHtml(machine.name)}</span>
        <span class="m-address">${escapeHtml(machine.address)}</span>
        <div class="m-meta">
          ${machineChip(machine.status)}
          <div class="fill-bar-track"><div class="fill-bar-fill" style="width:${machine.fill_level}%"></div></div>
          <span class="fill-value">${formatPercent(machine.fill_level)}</span>
        </div>
        <div class="m-ads">${machine.ad_slots_occupied}/${machine.ad_slots_total} Werbeflächen belegt</div>
      `;
      li.addEventListener('click', () => {
        map.setView([machine.lat, machine.lng], 16);
        const marker = markersById.get(machine.id);
        if (marker) marker.openPopup();
      });
      list.appendChild(li);
    });
  }

  async function refresh() {
    machines = await api('/api/machines');
    renderMarkers();
    renderList();
  }

  document.querySelectorAll('.filter-status').forEach((cb) => {
    cb.addEventListener('change', () => {
      renderMarkers();
      renderList();
    });
  });

  return {
    refresh,
    onEditRequest(handler) { onEdit = handler; },
    invalidateSize() { map.invalidateSize(); },
    center() { return map.getCenter(); },
    onMapClick(handler) { map.on('click', handler); },
  };
})();
