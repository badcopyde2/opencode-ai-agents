/* Verdrahtung: Ansichtswechsel, Automatenformular und Werbeflächenformular. */
(() => {
  const { escapeHtml, formatEuro, formatDate, api, showErrors, slotChip } = App;

  // ---------- Ansichtswechsel ----------

  const tabs = {
    dashboard: { tab: document.getElementById('tab-dashboard'), view: document.getElementById('view-dashboard') },
    map: { tab: document.getElementById('tab-map'), view: document.getElementById('view-map') },
  };

  function showView(name) {
    Object.entries(tabs).forEach(([key, { tab, view }]) => {
      const active = key === name;
      tab.setAttribute('aria-selected', String(active));
      view.classList.toggle('active', active);
    });
    // Leaflet muss die Größe neu messen, wenn die Karte aus dem Verborgenen kommt.
    if (name === 'map') MapView.invalidateSize();
  }

  tabs.dashboard.tab.addEventListener('click', () => showView('dashboard'));
  tabs.map.tab.addEventListener('click', () => showView('map'));

  async function refreshAll() {
    await Promise.all([Dashboard.refresh(), MapView.refresh()]);
  }

  // ---------- Automatenformular ----------

  const machineModal = document.getElementById('machine-modal');
  const machineForm = document.getElementById('machine-form');
  const machineErrors = document.getElementById('machine-errors');
  const fillInput = document.getElementById('f-fill');
  const deleteMachineBtn = document.getElementById('btn-delete-machine');
  const slotsSection = document.getElementById('slots-section');
  const slotList = document.getElementById('machine-slot-list');

  let currentMachineId = null;

  fillInput.addEventListener('input', () => {
    document.getElementById('f-fill-value').textContent = fillInput.value;
  });

  async function renderMachineSlots(machineId) {
    if (!machineId) {
      // Werbeflächen brauchen einen gespeicherten Automaten als Bezugspunkt.
      slotsSection.classList.add('hidden');
      slotList.innerHTML = '';
      return;
    }
    slotsSection.classList.remove('hidden');

    const slots = await api(`/api/machines/${machineId}/ad-slots`);
    if (!slots.length) {
      slotList.innerHTML = '<li class="empty-state">Noch keine Werbefläche an diesem Automaten.</li>';
      return;
    }

    slotList.innerHTML = slots.map((slot) => `
      <li>
        <div class="slot-main">
          <div class="slot-title">${escapeHtml(App.SLOT_POSITION[slot.position] || slot.position)} · ${slot.width_cm}×${slot.height_cm} cm</div>
          <div class="slot-detail">
            ${slot.advertiser ? escapeHtml(slot.advertiser) : 'frei'}
            ${slot.end_date ? ` · bis ${escapeHtml(formatDate(slot.end_date))}` : ''}
          </div>
        </div>
        ${slotChip(slot.status)}
        <span class="slot-price">${escapeHtml(formatEuro(slot.price_per_month))}</span>
        <button type="button" class="btn-secondary btn-small" data-slot-id="${slot.id}">Bearbeiten</button>
      </li>
    `).join('');

    slotList.querySelectorAll('[data-slot-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const slot = slots.find((s) => String(s.id) === btn.dataset.slotId);
        openSlotModal(machineId, slot);
      });
    });
  }

  async function openMachineModal(machine) {
    currentMachineId = machine ? machine.id : null;
    document.getElementById('machine-modal-title').textContent = machine ? 'Automat bearbeiten' : 'Neuer Automat';
    document.getElementById('f-id').value = machine ? machine.id : '';
    document.getElementById('f-name').value = machine ? machine.name : '';
    document.getElementById('f-address').value = machine ? machine.address : '';
    document.getElementById('f-lat').value = machine ? machine.lat : MapView.center().lat.toFixed(6);
    document.getElementById('f-lng').value = machine ? machine.lng : MapView.center().lng.toFixed(6);
    document.getElementById('f-status').value = machine ? machine.status : 'ok';
    fillInput.value = machine ? machine.fill_level : 100;
    document.getElementById('f-fill-value').textContent = fillInput.value;
    document.getElementById('f-notes').value = machine ? machine.notes || '' : '';

    deleteMachineBtn.classList.toggle('hidden', !machine);
    showErrors(machineErrors, null);
    machineModal.classList.remove('hidden');
    await renderMachineSlots(currentMachineId);
  }

  function closeMachineModal() {
    machineModal.classList.add('hidden');
    currentMachineId = null;
  }

  machineForm.addEventListener('submit', async (event) => {
    event.preventDefault();
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

    try {
      const saved = await api(id ? `/api/machines/${id}` : '/api/machines', {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      await refreshAll();
      if (id) {
        closeMachineModal();
      } else {
        // Nach dem Anlegen offen lassen, damit direkt Werbeflächen ergänzt werden können.
        await openMachineModal(saved);
      }
    } catch (err) {
      showErrors(machineErrors, err.fieldErrors);
    }
  });

  deleteMachineBtn.addEventListener('click', async () => {
    const id = document.getElementById('f-id').value;
    if (!id) return;
    if (!confirm('Diesen Automaten samt seiner Werbeflächen wirklich löschen?')) return;
    await api(`/api/machines/${id}`, { method: 'DELETE' });
    closeMachineModal();
    await refreshAll();
  });

  document.getElementById('btn-new-machine').addEventListener('click', () => openMachineModal(null));
  document.getElementById('btn-cancel-machine').addEventListener('click', closeMachineModal);
  machineModal.addEventListener('click', (e) => { if (e.target === machineModal) closeMachineModal(); });

  MapView.onEditRequest((machine) => openMachineModal(machine));
  MapView.onMapClick((e) => {
    if (machineModal.classList.contains('hidden')) return;
    document.getElementById('f-lat').value = e.latlng.lat.toFixed(6);
    document.getElementById('f-lng').value = e.latlng.lng.toFixed(6);
  });

  // ---------- Werbeflächenformular ----------

  const slotModal = document.getElementById('slot-modal');
  const slotForm = document.getElementById('slot-form');
  const slotErrors = document.getElementById('slot-errors');
  const slotStatusSelect = document.getElementById('s-status');
  const bookingFields = document.getElementById('s-booking-fields');
  const deleteSlotBtn = document.getElementById('btn-delete-slot');

  // Freie Flächen haben weder Partner noch Laufzeit – die Felder verschwinden dann.
  function syncBookingFields() {
    bookingFields.classList.toggle('hidden', slotStatusSelect.value === 'frei');
  }
  slotStatusSelect.addEventListener('change', syncBookingFields);

  function openSlotModal(machineId, slot) {
    document.getElementById('slot-modal-title').textContent = slot ? 'Werbefläche bearbeiten' : 'Neue Werbefläche';
    document.getElementById('s-id').value = slot ? slot.id : '';
    document.getElementById('s-machine-id').value = machineId;
    document.getElementById('s-position').value = slot ? slot.position : 'vorne';
    slotStatusSelect.value = slot ? slot.status : 'frei';
    document.getElementById('s-width').value = slot ? slot.width_cm : 40;
    document.getElementById('s-height').value = slot ? slot.height_cm : 30;
    document.getElementById('s-price').value = slot ? slot.price_per_month : 0;
    document.getElementById('s-advertiser').value = slot ? slot.advertiser || '' : '';
    document.getElementById('s-campaign').value = slot ? slot.campaign || '' : '';
    document.getElementById('s-start').value = slot ? slot.start_date || '' : '';
    document.getElementById('s-end').value = slot ? slot.end_date || '' : '';
    document.getElementById('s-notes').value = slot ? slot.notes || '' : '';

    deleteSlotBtn.classList.toggle('hidden', !slot);
    showErrors(slotErrors, null);
    syncBookingFields();
    slotModal.classList.remove('hidden');
  }

  function closeSlotModal() {
    slotModal.classList.add('hidden');
  }

  slotForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = document.getElementById('s-id').value;
    const payload = {
      machine_id: Number(document.getElementById('s-machine-id').value),
      position: document.getElementById('s-position').value,
      status: slotStatusSelect.value,
      width_cm: Number(document.getElementById('s-width').value),
      height_cm: Number(document.getElementById('s-height').value),
      price_per_month: Number(document.getElementById('s-price').value),
      advertiser: document.getElementById('s-advertiser').value,
      campaign: document.getElementById('s-campaign').value,
      start_date: document.getElementById('s-start').value || null,
      end_date: document.getElementById('s-end').value || null,
      notes: document.getElementById('s-notes').value,
    };

    try {
      await api(id ? `/api/ad-slots/${id}` : '/api/ad-slots', {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      closeSlotModal();
      await renderMachineSlots(currentMachineId);
      await refreshAll();
    } catch (err) {
      showErrors(slotErrors, err.fieldErrors);
    }
  });

  deleteSlotBtn.addEventListener('click', async () => {
    const id = document.getElementById('s-id').value;
    if (!id) return;
    if (!confirm('Diese Werbefläche wirklich löschen?')) return;
    await api(`/api/ad-slots/${id}`, { method: 'DELETE' });
    closeSlotModal();
    await renderMachineSlots(currentMachineId);
    await refreshAll();
  });

  document.getElementById('btn-add-slot').addEventListener('click', () => {
    if (currentMachineId) openSlotModal(currentMachineId, null);
  });
  document.getElementById('btn-cancel-slot').addEventListener('click', closeSlotModal);
  slotModal.addEventListener('click', (e) => { if (e.target === slotModal) closeSlotModal(); });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!slotModal.classList.contains('hidden')) closeSlotModal();
    else if (!machineModal.classList.contains('hidden')) closeMachineModal();
  });

  refreshAll();
})();
