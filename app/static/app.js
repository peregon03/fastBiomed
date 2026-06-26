const cfg = window.BIOMED_SUPABASE || {};
const hasSupabaseConfig = cfg.url && !cfg.url.includes('PEGA_AQUI') && cfg.anonKey && !cfg.anonKey.includes('PEGA_AQUI');
const supabaseClient = hasSupabaseConfig ? window.supabase?.createClient(cfg.url, cfg.anonKey) : null;

const state = {
  view: 'dashboard',
  area: '',
  status: '',
  search: '',
  equipment: [],
  history: [],
  allEquipment: [],
  dashboard: null,
  calendarDate: new Date(),
  calendarFilter: 'all',
  session: null,
  activeKpi: null,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function assertConfigured() {
  if (!supabaseClient) {
    throw new Error('Falta configurar Supabase en app/static/supabase-config.js');
  }
}

function todayDate() {
  return new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00');
}

function addMonths(dateString, months) {
  if (!dateString) return null;
  const date = new Date(`${dateString}T00:00:00`);
  const day = date.getDate();
  date.setMonth(date.getMonth() + months);
  if (date.getDate() !== day) date.setDate(0);
  return date.toISOString().slice(0, 10);
}

function updateNextMaintenancePreview() {
  const lastMaintenance = $('#last_maintenance').value;
  const frequency = Number($('#frequency_months').value || 6);
  $('#next_maintenance').value = lastMaintenance ? addMonths(lastMaintenance, frequency) : '';
}

function statusFor(item) {
  if (!item.next_maintenance) return 'Sin programacion';
  const due = new Date(`${item.next_maintenance}T00:00:00`);
  const delta = Math.round((due - todayDate()) / 86400000);
  if (delta < 0) return 'Vencido';
  if (delta <= 30) return 'Proximo a vencer';
  return 'Vigente';
}

function enrich(item) {
  const status = statusFor(item);
  const days = item.next_maintenance
    ? Math.round((new Date(`${item.next_maintenance}T00:00:00`) - todayDate()) / 86400000)
    : null;
  return { ...item, status, days_until_due: days };
}

function statusClass(status) {
  return status.split(' ')[0];
}

function statusLabel(status) {
  return status
    .replace('Proximo a vencer', 'Próximo a vencer')
    .replace('Sin programacion', 'Sin programación');
}

function areaLabel(area) {
  return area === 'Cirugia' ? 'Cirugía' : area;
}

function badge(status) {
  return `<span class="status ${statusClass(status)}">${statusLabel(status)}</span>`;
}

async function queryEquipment() {
  let query = supabaseClient.from('equipment').select('*').order('area').order('name');
  if (state.area) query = query.eq('area', state.area);
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data || []).map(enrich);
  return state.status ? rows.filter((item) => item.status === state.status) : rows;
}

async function queryHistory() {
  const { data, error } = await supabaseClient
    .from('maintenance_history')
    .select('*')
    .order('performed_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

function buildDashboard(allEquipment, history) {
  // KPIs solo sobre equipos con mantenimiento preventivo
  const equipment = allEquipment.filter(item => item.requires_maintenance !== false);
  const inventoryOnly = allEquipment.length - equipment.length;

  const total = equipment.length;
  const scheduled = equipment.filter((item) => item.next_maintenance && item.status !== 'Vencido').length;
  const completedIds = new Set(history.map(h => h.equipment_id));
  const completed = equipment.filter(item => completedIds.has(item.id)).length;
  const overdue = equipment.filter((item) => item.status === 'Vencido').length;
  const dueSoon = equipment.filter((item) => item.status === 'Proximo a vencer').length;
  const noSchedule = equipment.filter((item) => item.status === 'Sin programacion').length;
  const todayStr = todayDate().toISOString().slice(0, 10);
  const thisMonth = todayStr.slice(0, 7);
  const completedThisMonth = history.filter(h => h.performed_at.slice(0, 7) === thisMonth).length;
  const denominator = completed + overdue + dueSoon;
  const compliance = denominator > 0 ? Math.round((completed / denominator) * 1000) / 10 : 0;
  const statusCounts = {};
  const areaCounts = { UCI: 0, Urgencias: 0, Cirugia: 0 };
  const monthlyCompleted = {};
  equipment.forEach((item) => {
    statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
    areaCounts[item.area] = (areaCounts[item.area] || 0) + 1;
  });
  history.forEach((item) => {
    const key = item.performed_at.slice(0, 7);
    monthlyCompleted[key] = (monthlyCompleted[key] || 0) + 1;
  });
  const alerts = equipment.filter((item) =>
    ['Vencido', 'Proximo a vencer'].includes(item.status)
  );
  const unscheduled = equipment.filter((item) => item.status === 'Sin programacion');
  return {
    totals: { equipment: total, inventoryOnly, scheduled, dueSoon, overdue, completed, completedThisMonth, compliance, noSchedule },
    statusCounts,
    areaCounts,
    monthlyCompleted,
    alerts,
    unscheduled,
  };
}

async function refresh() {
  assertConfigured();
  const [filteredEquipment, history, allRows] = await Promise.all([
    queryEquipment(),
    queryHistory(),
    supabaseClient.from('equipment').select('*').order('area').order('name'),
  ]);
  if (allRows.error) throw allRows.error;
  const allEquipment = (allRows.data || []).map(enrich);
  state.equipment = filteredEquipment;
  state.history = history;
  state.allEquipment = allEquipment;
  state.dashboard = buildDashboard(allEquipment, history);
  renderDashboard();
  renderEquipment();
  renderCalendar();
}

function renderKpiDetail() {
  const panel = $('#kpiDetail');
  const type = state.activeKpi;
  const labels = {
    total: 'Todos los equipos',
    scheduled: 'Equipos programados',
    dueSoon: 'Próximos a vencer',
    overdue: 'Equipos vencidos',
    noSchedule: 'Equipos sin programar',
    completed: 'Mantenimientos realizados',
    thisMonth: 'Realizados este mes',
  };
  const title = labels[type] || '';

  if (type === 'thisMonth') {
    const filterKey = todayDate().toISOString().slice(0, 7);
    const records = state.history.filter(h => h.performed_at.startsWith(filterKey));
    const rows = records.map(h => {
      const eq = state.allEquipment.find(e => e.id === h.equipment_id);
      return `<div class="kpi-detail-item">
        <div>
          <strong>${eq?.name || '—'}</strong>
          <div class="meta-line">${eq ? areaLabel(eq.area) + ' · ' + eq.plate : ''} · Realizado: ${h.performed_at}</div>
        </div>
        <span class="status Vigente">Realizado</span>
      </div>`;
    }).join('');
    panel.innerHTML = `
      <div class="panel-head"><h2>${title}</h2><span class="pill">${records.length} registros</span></div>
      ${records.length ? `<div class="kpi-detail-list">${rows}</div>` : '<p>No hay registros en este período.</p>'}
    `;
    return;
  }

  if (type === 'completed') {
    const records = state.history;
    const rows = records.map(h => {
      const eq = state.allEquipment.find(e => e.id === h.equipment_id);
      return `<div class="kpi-detail-item">
        <div>
          <strong>${eq?.name || '—'}</strong>
          <div class="meta-line">${eq ? areaLabel(eq.area) + ' · ' + eq.plate : ''} · Realizado: ${h.performed_at}</div>
        </div>
        <span class="status Vigente">Realizado</span>
      </div>`;
    }).join('');
    panel.innerHTML = `
      <div class="panel-head"><h2>${title}</h2><span class="pill">${records.length} registros</span></div>
      ${records.length ? `<div class="kpi-detail-list">${rows}</div>` : '<p>No hay registros de mantenimiento.</p>'}
    `;
    return;
  }

  if (type === 'scheduled') {
    const items = state.allEquipment.filter(e => e.next_maintenance);
    const rows = items.map(item => `
      <div class="kpi-detail-item">
        <div>
          <strong>${item.name}</strong>
          <div class="meta-line">${areaLabel(item.area)} · ${item.plate} · Próximo: ${item.next_maintenance}</div>
        </div>
        ${badge(item.status)}
      </div>
    `).join('');
    panel.innerHTML = `
      <div class="panel-head"><h2>Equipos programados</h2><span class="pill">${items.length} equipos</span></div>
      ${items.length ? `<div class="kpi-detail-list">${rows}</div>` : '<p>Sin equipos programados.</p>'}
    `;
    return;
  }

  const statusMap = { total: null, dueSoon: 'Proximo a vencer', overdue: 'Vencido', noSchedule: 'Sin programacion' };
  const filterStatus = statusMap[type];
  const items = filterStatus
    ? state.allEquipment.filter(e => e.status === filterStatus)
    : state.allEquipment;

  const rows = items.map(item => `
    <div class="kpi-detail-item">
      <div>
        <strong>${item.name}</strong>
        <div class="meta-line">${areaLabel(item.area)} · ${item.plate} · ${item.next_maintenance ? 'Próximo: ' + item.next_maintenance : 'Sin fecha'}</div>
      </div>
      ${badge(item.status)}
    </div>
  `).join('');

  panel.innerHTML = `
    <div class="panel-head"><h2>${title}</h2><span class="pill">${items.length} equipos</span></div>
    ${items.length ? `<div class="kpi-detail-list">${rows}</div>` : '<p>Sin equipos en este estado.</p>'}
  `;
}

function showKpiDetail(type) {
  const panel = $('#kpiDetail');
  if (state.activeKpi === type) {
    state.activeKpi = null;
    panel.hidden = true;
    $$('.kpi[data-kpi]').forEach(c => c.classList.remove('active'));
    return;
  }
  state.activeKpi = type;
  $$('.kpi[data-kpi]').forEach(c => c.classList.toggle('active', c.dataset.kpi === type));
  renderKpiDetail();
  panel.hidden = false;
}

function renderDashboard() {
  const data = state.dashboard;
  $('#kpiEquipment').textContent = data.totals.equipment;
  $('#kpiScheduled').textContent = data.totals.scheduled;
  $('#kpiDueSoon').textContent = data.totals.dueSoon;
  $('#kpiOverdue').textContent = data.totals.overdue;
  const noScheduleCard = $('#kpiNoSchedule').closest('article');
  noScheduleCard.hidden = data.totals.noSchedule === 0;
  $('#kpiNoSchedule').textContent = data.totals.noSchedule;
  $('#kpiCompleted').textContent = data.totals.completed;
  $('#kpiThisMonth').textContent = data.totals.completedThisMonth;
  $('#kpiCompliance').textContent = `${data.totals.compliance}%`;
  $('#alertCount').textContent = `${data.alerts.length} alertas`;
  $('#alerts').innerHTML = data.alerts.length ? data.alerts.map(item => `
    <article class="alert-item">
      <div>
        <strong>${item.name}</strong>
        <div class="meta-line">${areaLabel(item.area)} · ${item.plate} · ${item.next_maintenance || 'Sin fecha'}</div>
      </div>
      ${badge(item.status)}
    </article>
  `).join('') : '<p>No hay alertas activas.</p>';
  const unscheduledSection = $('#unscheduledSection');
  if (data.unscheduled.length) {
    unscheduledSection.hidden = false;
    $('#unscheduledCount').textContent = data.unscheduled.length;
    $('#unscheduledList').innerHTML = data.unscheduled.map(item => `
      <article class="alert-item">
        <div>
          <strong>${item.name}</strong>
          <div class="meta-line">${areaLabel(item.area)} · ${item.plate}</div>
        </div>
        ${badge(item.status)}
      </article>
    `).join('');
  } else {
    unscheduledSection.hidden = true;
  }
  drawBarChart($('#statusChart'), data.statusCounts, {
    'Vigente': '#16803c',
    'Proximo a vencer': '#fbbf24',
    'Vencido': '#b42318',
    'Sin programacion': '#64748b',
  });
  drawBarChart($('#areaChart'), data.areaCounts, {
    'UCI': '#2563eb',
    'Urgencias': '#0f766e',
    'Cirugia': '#7c3aed',
  });
  if (state.activeKpi) renderKpiDetail();
}

function drawBarChart(canvas, values, colors) {
  const ctx = canvas.getContext('2d');
  const width = (canvas.parentElement ? canvas.parentElement.clientWidth : 0) || canvas.getAttribute('data-width') || 420;
  const height = Number(canvas.getAttribute('height'));
  canvas.width = width * devicePixelRatio;
  canvas.height = height * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  ctx.clearRect(0, 0, width, height);
  const entries = Object.entries(values);
  const max = Math.max(1, ...entries.map(([, value]) => value));
  const gap = 14;
  const barWidth = Math.max(28, (width - gap * (entries.length + 1)) / Math.max(entries.length, 1));
  ctx.font = '12px Segoe UI, Arial';
  entries.forEach(([label, value], index) => {
    const x = gap + index * (barWidth + gap);
    const barHeight = Math.round((height - 60) * value / max);
    const y = height - 34 - barHeight;
    ctx.fillStyle = colors[label] || '#2563eb';
    ctx.fillRect(x, y, barWidth, barHeight);
    ctx.fillStyle = '#152033';
    ctx.textAlign = 'center';
    ctx.fillText(value, x + barWidth / 2, y - 7);
    ctx.fillStyle = '#637083';
    const shortLabel = statusLabel(label).replace('Próximo a vencer', 'Próximo').replace('Sin programación', 'Sin prog.');
    ctx.fillText(shortLabel, x + barWidth / 2, height - 12);
  });
}

function renderEquipment() {
  const term = state.search.toLowerCase();
  const items = state.equipment.filter(item => {
    return [item.name, item.plate, item.serial_number, item.location,
            item.specific_location, item.area, item.brand, item.model]
      .filter(Boolean).join(' ')
      .toLowerCase()
      .includes(term);
  });
  $('#equipmentList').innerHTML = items.map(item => {
    const locationLine = [areaLabel(item.area), item.specific_location || item.location].filter(Boolean).join(' · ');
    const brandModel = [item.brand, item.model].filter(Boolean).join(' ');
    const hasMaint = item.requires_maintenance;
    return `
    <article class="equipment-card${hasMaint ? '' : ' inventory-only'}" data-id="${item.id}">
      <div>
        <h3>${item.name}</h3>
        <p>${locationLine}</p>
        ${brandModel ? `<p class="brand-model">${brandModel}</p>` : ''}
      </div>
      ${hasMaint ? badge(item.status) : '<span class="status inventory">Solo inventario</span>'}
      <div class="meta">
        <span>Placa</span><strong>${item.plate}</strong>
        <span>Serie</span><strong>${item.serial_number}</strong>
        ${hasMaint ? `
        <span>Último</span><strong>${item.last_maintenance || 'Sin registro'}</strong>
        <span>Próximo</span><strong>${item.next_maintenance || 'Sin programación'}</strong>
        <span>Frecuencia</span><strong>${item.frequency_months} meses</strong>
        ` : ''}
      </div>
    </article>`;
  }).join('') || '<p>No se encontraron equipos con los filtros actuales.</p>';
  $$('.equipment-card').forEach(card => {
    card.addEventListener('click', () => openEquipment(card.dataset.id));
  });
}

function renderYearOverview() {
  const year = state.calendarDate.getFullYear();
  const activeMonth = state.calendarDate.getMonth();
  const filter = state.calendarFilter;
  const statusColors = {
    'Vencido': '#b42318',
    'Proximo a vencer': '#fbbf24',
    'Vigente': '#16803c',
    'completed': '#16803c',
  };

  // Construir mapa de eventos: 'YYYY-MM-DD' → [items]
  const eventMap = {};
  const addEvent = (date, item) => {
    if (!eventMap[date]) eventMap[date] = [];
    eventMap[date].push(item);
  };
  if (filter === 'completed') {
    state.history.forEach(h => {
      if (h.performed_at?.slice(0, 4) === String(year)) addEvent(h.performed_at, { status: 'completed' });
    });
  } else {
    const source = filter === 'all' ? state.allEquipment : state.allEquipment.filter(e => e.status === filter);
    source.forEach(item => {
      if (item.next_maintenance?.slice(0, 4) === String(year)) addEvent(item.next_maintenance, item);
    });
  }

  // Color mas urgente del dia
  const dayColor = (events) => {
    if (filter !== 'all') return statusColors[filter] || '#2563eb';
    const statuses = events.map(e => e.status);
    for (const s of ['Vencido', 'Proximo a vencer', 'Vigente', 'completed']) {
      if (statuses.includes(s)) return statusColors[s];
    }
    return '#2563eb';
  };

  const months = [];
  for (let m = 0; m < 12; m++) {
    const firstDay = new Date(year, m, 1);
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    const firstWeekday = (firstDay.getDay() + 6) % 7;
    const monthName = firstDay.toLocaleDateString('es-CO', { month: 'long' });
    let cells = '<div class="mini-day"></div>'.repeat(firstWeekday);
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const events = eventMap[iso];
      if (events?.length) {
        const color = dayColor(events);
        const count = events.length > 1 ? ` title="${events.length} equipos"` : '';
        cells += `<div class="mini-day has-event" style="background:${color}"${count}></div>`;
      } else {
        cells += `<div class="mini-day">${d}</div>`;
      }
    }
    months.push(`
      <div class="mini-month${m === activeMonth ? ' active' : ''}" data-month="${m}">
        <div class="mini-month-title">${monthName}</div>
        <div class="mini-grid">${cells}</div>
      </div>
    `);
  }
  $('#yearOverview').innerHTML = months.join('');
  $$('.mini-month').forEach(card => {
    card.addEventListener('click', () => {
      state.calendarDate = new Date(year, parseInt(card.dataset.month), 1);
      renderCalendar();
      $('.calendar-shell').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function renderCalendar() {
  const current = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth(), 1);
  const year = current.getFullYear();
  const month = current.getMonth();
  $('#calendarTitle').textContent = current.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
  const firstWeekday = (current.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - firstWeekday);
  const monthItems = state.equipment.filter(item => {
    if (!item.next_maintenance) return false;
    const d = new Date(`${item.next_maintenance}T00:00:00`);
    return d.getFullYear() === year && d.getMonth() === month;
  });
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const dayEvents = monthItems.filter(item => item.next_maintenance === iso);
    cells.push(`
      <div class="day ${d.getMonth() === month ? '' : 'muted'}">
        <strong>${d.getDate()}</strong>
        ${dayEvents.map(event => `
          <div class="event ${statusClass(event.status)}" title="${event.plate} · ${event.location}">
            ${event.name}<br>${areaLabel(event.area)}
          </div>
        `).join('')}
      </div>
    `);
  }
  $('#calendarGrid').innerHTML = cells.join('');
  renderYearOverview();
}

function switchView(view) {
  state.view = view;
  $$('.view').forEach(section => section.classList.toggle('active', section.id === view));
  $$('.nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
  const titles = {
    dashboard: ['Dashboard', 'Indicadores, alertas y estado global del programa.'],
    equipos: ['Equipos', 'Inventario biomédico por área y estado de mantenimiento.'],
    calendario: ['Calendario', 'Programación mensual de mantenimientos preventivos.'],
    datos: ['Gestión de datos', 'Importación, actualización y reportes.'],
  };
  $('#pageTitle').textContent = titles[view][0];
  $('#pageSubtitle').textContent = titles[view][1];
}

function openEquipment(id = null) {
  const item = state.allEquipment.find(e => String(e.id) === String(id));
  $('#equipmentId').value = item?.id || '';
  $('#formTitle').textContent = item ? 'Editar equipo' : 'Nuevo equipo';
  $('#name').value = item?.name || '';
  $('#plate').value = item?.plate || '';
  $('#serial_number').value = item?.serial_number || '';
  $('#brand').value = item?.brand || '';
  $('#model').value = item?.model || '';
  $('#specific_location').value = item?.specific_location || '';
  $('#location').value = item?.location || '';
  $('#area').value = item?.area || 'UCI';
  const req = item ? Boolean(item.requires_maintenance) : true;
  $('#requires_maintenance').checked = req;
  $('#maintenanceFields').hidden = !req;
  $('#completeMaintenance').style.display = req ? '' : 'none';
  $('#last_maintenance').value = item?.last_maintenance || '';
  $('#frequency_months').value = item?.frequency_months || 6;
  $('#next_maintenance').value = item?.next_maintenance || '';
  updateNextMaintenancePreview();
  $('#deleteEquipment').style.visibility = item ? 'visible' : 'hidden';
  $('#completeMaintenance').style.visibility = item ? 'visible' : 'hidden';
  $('#equipmentDialog').showModal();
}

function formPayload() {
  const req = $('#requires_maintenance').checked;
  const lastMaintenance = req ? ($('#last_maintenance').value || null) : null;
  const frequency = req ? Number($('#frequency_months').value) : 0;
  return {
    name: $('#name').value.trim(),
    plate: $('#plate').value.trim(),
    serial_number: $('#serial_number').value.trim(),
    brand: $('#brand').value.trim() || null,
    model: $('#model').value.trim() || null,
    specific_location: $('#specific_location').value.trim() || null,
    location: $('#location').value.trim(),
    area: $('#area').value,
    requires_maintenance: req,
    last_maintenance: lastMaintenance,
    next_maintenance: lastMaintenance ? addMonths(lastMaintenance, frequency) : null,
    frequency_months: frequency,
  };
}

async function saveForm(event) {
  event.preventDefault();
  const id = $('#equipmentId').value;
  const payload = formPayload();
  const result = id
    ? await supabaseClient.from('equipment').update(payload).eq('id', id).select().single()
    : await supabaseClient.from('equipment').insert(payload).select().single();
  if (result.error) throw result.error;
  $('#equipmentDialog').close();
  await refresh();
}

async function completeMaintenance() {
  const id = $('#equipmentId').value;
  const item = state.equipment.find(e => String(e.id) === String(id));
  if (!item) return;
  const performedAt = new Date().toISOString().slice(0, 10);
  const newNext = addMonths(performedAt, Number(item.frequency_months));
  const update = await supabaseClient
    .from('equipment')
    .update({ last_maintenance: performedAt, next_maintenance: newNext })
    .eq('id', id);
  if (update.error) throw update.error;
  const history = await supabaseClient.from('maintenance_history').insert({
    equipment_id: id,
    performed_at: performedAt,
    previous_next_date: item.next_maintenance,
    new_next_date: newNext,
    notes: 'Registro desde dashboard',
  });
  if (history.error) throw history.error;
  $('#equipmentDialog').close();
  await refresh();
}

function normalizeArea(value) {
  const area = String(value || '').trim().toLowerCase();
  if (area === 'cirugía' || area === 'cirugia') return 'Cirugia';
  if (area === 'uci') return 'UCI';
  if (area === 'urgencias') return 'Urgencias';
  return value;
}

const MONTH_NAMES = ['enero','febrero','marzo','abril','mayo','junio',
                     'julio','agosto','septiembre','octubre','noviembre','diciembre'];

function normalizeRow(row, sheetArea = null) {
  const lookup = {};
  Object.keys(row).forEach((key) => {
    lookup[String(key).trim().toLowerCase()] = row[key];
  });

  // Área: prioridad hoja > columna
  const areaRaw = sheetArea || lookup['área'] || lookup['area'] || '';
  const area = normalizeArea(areaRaw);

  // requires_maintenance
  const reqRaw = String(lookup['requiere mantenimiento preventivo'] || lookup['requiere mantenimiento'] || lookup['requiere'] || 'SI').trim().toUpperCase();
  const requires = ['SI', 'SÍ', 'S', '1', 'YES', 'TRUE'].includes(reqRaw);

  // frequency
  const frequencyRaw = String(lookup['frecuencia mantenimiento'] || lookup.frecuencia || lookup.frequency_months || '6').toLowerCase();
  const frequency = !requires ? 0 : (frequencyRaw.includes('12') || frequencyRaw.includes('anual') ? 12 : 6);

  // fechas
  const lastMaintenance = lookup['ultimo mantenimiento'] || lookup['último mantenimiento'] || lookup.last_maintenance || null;
  let nextMaintenance = lookup['proximo mantenimiento'] || lookup['próximo mantenimiento'] || lookup.next_maintenance || null;

  // Derivar next_maintenance desde columnas de mes (ENERO…DICIEMBRE con 'x')
  if (requires && !nextMaintenance) {
    const today = new Date();
    const currentMonth = today.getMonth(); // 0-indexed
    const currentYear = today.getFullYear();
    const markedMonths = MONTH_NAMES
      .map((m, i) => ({ i, val: String(lookup[m] || '').trim().toLowerCase() }))
      .filter(({ val }) => val === 'x');
    const future = markedMonths.filter(({ i }) => i >= currentMonth);
    const target = future.length ? future[0] : (markedMonths.length ? markedMonths[markedMonths.length - 1] : null);
    if (target) {
      const year = future.length ? currentYear : currentYear + 1;
      nextMaintenance = `${year}-${String(target.i + 1).padStart(2, '0')}-01`;
    }
  }

  const specificLocation = String(lookup['ubicación'] || lookup['ubicacion'] || '').trim();

  return {
    name: String(lookup['nombre del equipo'] || lookup['nombre'] || lookup['equipo'] || '').trim(),
    plate: String(lookup['placa'] || '').trim(),
    serial_number: String(lookup['número de serie'] || lookup['numero de serie'] || lookup['serie'] || lookup['serial'] || '').trim(),
    brand: String(lookup['marca'] || lookup['brand'] || '').trim() || null,
    model: String(lookup['modelo'] || lookup['model'] || '').trim() || null,
    specific_location: specificLocation || null,
    location: specificLocation || area || '',
    area,
    requires_maintenance: requires,
    last_maintenance: lastMaintenance || null,
    next_maintenance: nextMaintenance || (lastMaintenance ? addMonths(lastMaintenance, frequency) : null),
    frequency_months: frequency,
    pending_intervention: false,
  };
}

async function importFile(file) {
  const buffer = await file.arrayBuffer();
  let allRows = [];

  if (file.name.toLowerCase().endsWith('.xlsx')) {
    const workbook = XLSX.read(buffer, { type: 'array' });
    workbook.SheetNames.forEach(sheetName => {
      const sheetArea = normalizeArea(sheetName.trim()) || null;
      const ws = workbook.Sheets[sheetName];
      // Convertir a array de arrays para detectar la fila de cabeceras
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      // Buscar la fila que contiene 'NOMBRE' o 'SERIE' (cabecera real)
      const headerIdx = raw.findIndex(row =>
        row.some(cell => ['nombre','serie','placa'].includes(String(cell).trim().toLowerCase()))
      );
      if (headerIdx === -1) return; // hoja sin datos reconocibles
      const headers = raw[headerIdx].map(c => String(c).trim().toLowerCase());
      raw.slice(headerIdx + 1).forEach(cells => {
        const row = {};
        headers.forEach((h, i) => { row[h] = cells[i] ?? ''; });
        allRows.push({ row, sheetArea });
      });
    });
  } else {
    const text = new TextDecoder('utf-8').decode(buffer);
    const workbook = XLSX.read(text, { type: 'string', raw: true });
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
    rows.forEach(row => allRows.push({ row, sheetArea: null }));
  }

  const payload = allRows
    .map(({ row, sheetArea }) => normalizeRow(row, sheetArea))
    .filter(r => r.name && r.plate);

  if (!payload.length) throw new Error('No se encontraron filas válidas para importar.');

  let imported = 0;
  const errors = [];
  for (const item of payload) {
    const { error } = await supabaseClient.from('equipment').upsert(item, { onConflict: 'plate' });
    if (error) {
      console.error('Supabase upsert error:', JSON.stringify(error));
      errors.push(`${item.plate}: [${error.code}] ${error.message}${error.details ? ' — ' + error.details : ''}`);
    } else imported++;
  }
  if (errors.length) throw new Error(`${imported} importados. Errores:\n` + errors.join('\n'));
  return imported;
}

function exportExcel() {
  const headers = ['Equipo', 'Placa', 'Serie', 'Marca', 'Modelo', 'Ubicación específica', 'Área',
                   'Requiere mantenimiento', 'Último mantenimiento', 'Próximo mantenimiento', 'Frecuencia', 'Estado'];
  const rows = state.allEquipment.map(item => [
    item.name,
    item.plate,
    item.serial_number,
    item.brand || '',
    item.model || '',
    item.specific_location || item.location,
    areaLabel(item.area),
    item.requires_maintenance ? 'SI' : 'NO',
    item.last_maintenance || '',
    item.next_maintenance || '',
    item.requires_maintenance ? `${item.frequency_months} meses` : '',
    item.requires_maintenance ? statusLabel(item.status) : 'Solo inventario',
  ]);
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Inventario biomédico');
  XLSX.writeFile(book, 'inventario_biomedico.xlsx');
}

function exportPdf() {
  const rows = state.dashboard.alerts.map(item => `
    <tr><td>${item.name}</td><td>${item.plate}</td><td>${areaLabel(item.area)}</td><td>${item.next_maintenance || ''}</td><td>${statusLabel(item.status)}</td></tr>
  `).join('');
  const win = window.open('', '_blank');
  win.document.write(`
    <!doctype html><html><head><meta charset="utf-8"><title>Reporte</title>
    <style>body{font-family:Arial;margin:32px;color:#172033}table{border-collapse:collapse;width:100%}
    th,td{border:1px solid #ccd3df;padding:8px;text-align:left}th{background:#edf2f7}</style></head>
    <body><h1>Reporte de mantenimientos preventivos</h1>
    <p>Total equipos: ${state.dashboard.totals.equipment} | Programados: ${state.dashboard.totals.scheduled} |
    Vencidos: ${state.dashboard.totals.overdue} | Cumplimiento: ${state.dashboard.totals.compliance}%</p>
    <h2>Alertas activas</h2><table><tr><th>Equipo</th><th>Placa</th><th>Área</th><th>Fecha</th><th>Estado</th></tr>${rows}</table>
    <script>window.addEventListener('load', () => setTimeout(() => window.print(), 300));</script></body></html>
  `);
  win.document.close();
}

function showApp(active) {
  document.body.classList.toggle('is-authenticated', active);
  $('#loginScreen').style.display = active ? 'none' : 'grid';
  $$('.app-shell').forEach(el => { el.style.display = active ? '' : 'none'; });
}

async function loadSession() {
  assertConfigured();
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) throw error;
  state.session = data.session;
  showApp(Boolean(state.session));
  if (state.session) await refresh();
}

function startClock() {
  const TZ = 'America/Bogota';
  function tick() {
    const now = new Date();
    $('#clockTime').textContent = now.toLocaleTimeString('es-CO', {
      timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
    });
    $('#clockDate').textContent = now.toLocaleDateString('es-CO', {
      timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  }
  tick();
  setInterval(tick, 1000);
}

function wireEvents() {
  $('#loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    $('#loginError').textContent = '';
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: $('#loginEmail').value,
      password: $('#loginPassword').value,
    });
    if (error) {
      $('#loginError').textContent = 'Credenciales inválidas o usuario no autorizado.';
      return;
    }
    state.session = data.session;
    showApp(true);
    await refresh();
  });
  $('#logoutBtn').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    state.session = null;
    showApp(false);
  });
  $$('.kpi[data-kpi]').forEach(card => card.addEventListener('click', () => showKpiDetail(card.dataset.kpi)));
  $$('.nav-btn').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));
  $$('.area-filter button').forEach(btn => btn.addEventListener('click', async () => {
    state.area = btn.dataset.area;
    $$('.area-filter button').forEach(item => item.classList.toggle('active', item === btn));
    await refresh();
  }));
  $('#statusFilter').addEventListener('change', async event => {
    state.status = event.target.value;
    await refresh();
  });
  $('#search').addEventListener('input', event => {
    state.search = event.target.value;
    renderEquipment();
  });
  $('#newEquipment').addEventListener('click', () => openEquipment());
  $('#closeDialog').addEventListener('click', () => $('#equipmentDialog').close());
  $('#requires_maintenance').addEventListener('change', () => {
    const req = $('#requires_maintenance').checked;
    $('#maintenanceFields').hidden = !req;
    $('#completeMaintenance').style.display = req ? '' : 'none';
    if (!req) {
      $('#last_maintenance').value = '';
      $('#next_maintenance').value = '';
    }
  });
  $('#last_maintenance').addEventListener('change', updateNextMaintenancePreview);
  $('#frequency_months').addEventListener('change', updateNextMaintenancePreview);
  $('#equipmentForm').addEventListener('submit', saveForm);
  $('#deleteEquipment').addEventListener('click', async () => {
    const id = $('#equipmentId').value;
    const equipmentName = $('#name').value || 'este equipo';
    const plate = $('#plate').value ? ` (${$('#plate').value})` : '';
    if (!id || !confirm(`¿Desea eliminar definitivamente ${equipmentName}${plate}? Esta acción no se puede deshacer.`)) return;
    const { error } = await supabaseClient.from('equipment').delete().eq('id', id);
    if (error) throw error;
    $('#equipmentDialog').close();
    await refresh();
  });
  $('#completeMaintenance').addEventListener('click', completeMaintenance);
  $('#calFilter').addEventListener('change', e => {
    state.calendarFilter = e.target.value;
    renderYearOverview();
  });
  $('#prevMonth').addEventListener('click', () => {
    state.calendarDate.setMonth(state.calendarDate.getMonth() - 1);
    renderCalendar();
  });
  $('#nextMonth').addEventListener('click', () => {
    state.calendarDate.setMonth(state.calendarDate.getMonth() + 1);
    renderCalendar();
  });
  $('#exportExcel').addEventListener('click', exportExcel);
  $('#exportPdf').addEventListener('click', exportPdf);
  $('#importBtn').addEventListener('click', async () => {
    const file = $('#importFile').files[0];
    if (!file) {
      $('#importResult').textContent = 'Seleccione un archivo CSV o XLSX.';
      return;
    }
    try {
      const imported = await importFile(file);
      $('#importResult').textContent = `Importados: ${imported}`;
      await refresh();
    } catch (error) {
      $('#importResult').textContent = error.message;
    }
  });
}

wireEvents();
startClock();
showApp(false);
loadSession().catch(error => {
  $('#loginError').textContent = error.message;
});
