const STATUS_LABELS = {
  ok: 'OK',
  defekt: 'Defekt',
  ausser_betrieb: 'Außer Betrieb',
};

const map = L.map('map').setView([52.52, 13.405], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap-Mitwirkende',
  maxZoom: 19,
}).addTo(map);

let machines = [];
const markersById = new Map();
let pickingLocation = false;

function fillColor(level) {
  if (level >= 50) return '#16a34a';
  if (level >= 20) return '#d97706';
  return '#dc2626';
}

function markerColor(machine) {
  if (machine.status === 'defekt') return '#dc2626';
  if (machine.status === 'ausser_betrieb') return '#6b7280';
  return fillColor(machine.fill_level);
}

function makeIcon(machine) {
  const color = markerColor(machine);
  return L.divIcon({
    className: '',
    html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 3px rgba(0,0,0,0.5);"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function popupHtml(machine) {
  return `
    <div class="popup-content">
      <h3>${escapeHtml(machine.name)}</h3>
      <div>${escapeHtml(machine.address)}</div>
      <div style="margin-top:0.4rem;"><span class="badge status-${machine.status}"></span> ${STATUS_LABELS[machine.status]}</div>
      <div>Befüllstand: ${machine.fill_level}%</div>
      <div class="fill-bar-track"><div class="fill-bar-fill" style="width:${machine.fill_level}%;background:${fillColor(machine.fill_level)};"></div></div>
      ${machine.notes ? `<div>📝 ${escapeHtml(machine.notes)}</div>` : ''}
      <div style="color:#9ca3af;font-size:0.72rem;margin-top:0.3rem;">Stand: ${formatDate(machine.updated_at)}</div>
      <button data-edit-id="${machine.id}">Bearbeiten</button>
    </div>
  `;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso.replace(' ', 'T') + 'Z').toLocaleString('de-DE');
}

function activeStatuses() {
  return [...document.querySelectorAll('.filter-status:checked')].map((c) => c.value);
}

function renderMarkers() {
  markersById.forEach((m) => map.removeLayer(m));
  markersById.clear();

  const active = activeStatuses();
  machines.filter((m) => active.includes(m.status)).forEach((machine) => {
    const marker = L.marker([machine.lat, machine.lng], { icon: makeIcon(machine) })
      .addTo(map)
      .bindPopup(popupHtml(machine));
    marker.on('popupopen', () => {
      const btn = document.querySelector(`[data-edit-id="${machine.id}"]`);
      if (btn) btn.addEventListener('click', () => openModal(machine));
    });
    markersById.set(machine.id, marker);
  });
}

function renderList() {
  const list = document.getElementById('machine-list');
  const active = activeStatuses();
  list.innerHTML = '';
  machines.filter((m) => active.includes(m.status)).forEach((machine) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="m-name">${escapeHtml(machine.name)}</span>
      <span class="m-address">${escapeHtml(machine.address)}</span>
      <div class="m-meta">
        <span class="badge status-${machine.status}"></span>
        <span>${STATUS_LABELS[machine.status]}</span>
        <div class="fill-bar-track"><div class="fill-bar-fill" style="width:${machine.fill_level}%;background:${fillColor(machine.fill_level)};"></div></div>
        <span>${machine.fill_level}%</span>
      </div>
    `;
    li.addEventListener('click', () => {
      map.setView([machine.lat, machine.lng], 16);
      const marker = markersById.get(machine.id);
      if (marker) marker.openPopup();
    });
    list.appendChild(li);
  });
}

async function loadMachines() {
  const res = await fetch('/api/machines');
  machines = await res.json();
  renderMarkers();
  renderList();
}

document.querySelectorAll('.filter-status').forEach((cb) => {
  cb.addEventListener('change', () => {
    renderMarkers();
    renderList();
  });
});

// --- Modal handling ---
const backdrop = document.getElementById('modal-backdrop');
const form = document.getElementById('machine-form');
const fillInput = document.getElementById('f-fill');
const fillValueLabel = document.getElementById('f-fill-value');
const deleteBtn = document.getElementById('btn-delete');

fillInput.addEventListener('input', () => {
  fillValueLabel.textContent = fillInput.value;
});

function openModal(machine) {
  document.getElementById('modal-title').textContent = machine ? 'Automat bearbeiten' : 'Neuer Automat';
  document.getElementById('f-id').value = machine ? machine.id : '';
  document.getElementById('f-name').value = machine ? machine.name : '';
  document.getElementById('f-address').value = machine ? machine.address : '';
  document.getElementById('f-lat').value = machine ? machine.lat : map.getCenter().lat.toFixed(6);
  document.getElementById('f-lng').value = machine ? machine.lng : map.getCenter().lng.toFixed(6);
  document.getElementById('f-status').value = machine ? machine.status : 'ok';
  fillInput.value = machine ? machine.fill_level : 100;
  fillValueLabel.textContent = fillInput.value;
  document.getElementById('f-notes').value = machine ? machine.notes || '' : '';
  deleteBtn.classList.toggle('hidden', !machine);
  backdrop.classList.remove('hidden');
}

function closeModal() {
  backdrop.classList.add('hidden');
}

document.getElementById('btn-new').addEventListener('click', () => openModal(null));
document.getElementById('btn-cancel').addEventListener('click', closeModal);
backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });

map.on('click', (e) => {
  if (!backdrop.classList.contains('hidden')) {
    document.getElementById('f-lat').value = e.latlng.lat.toFixed(6);
    document.getElementById('f-lng').value = e.latlng.lng.toFixed(6);
  }
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('f-id').value;
  const payload = {
    name: document.getElementById('f-name').value,
    address: document.getElementById('f-address').value,
    lat: Number(document.getElementById('f-lat').value),
    lng: Number(document.getElementById('f-lng').value),
    status: document.getElementById('f-status').value,
    fill_level: Number(fillInput.value),
    notes: document.getElementById('f-notes').value,
  };

  const url = id ? `/api/machines/${id}` : '/api/machines';
  const method = id ? 'PUT' : 'POST';
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    alert('Fehler: ' + (body.errors ? body.errors.join(', ') : res.statusText));
    return;
  }

  closeModal();
  await loadMachines();
});

deleteBtn.addEventListener('click', async () => {
  const id = document.getElementById('f-id').value;
  if (!id) return;
  if (!confirm('Diesen Automaten wirklich löschen?')) return;
  await fetch(`/api/machines/${id}`, { method: 'DELETE' });
  closeModal();
  await loadMachines();
});

loadMachines();
