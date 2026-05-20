/* ─── Config ────────────────────────────────────────────────────────────── */
const API = '/api';

/* ─── State ─────────────────────────────────────────────────────────────── */
let allInvoices = [];
let editingId   = null;
let currentView = 'new';

/* ─── Init ──────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  setDefaultDates();
  await loadAll();
  resetForm();
});

/* ─── API helpers ───────────────────────────────────────────────────────── */
async function apiFetch(path, opts = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

async function loadAll() {
  try {
    allInvoices = await apiFetch('/invoices');
    renderSidebar();
  } catch (e) {
    console.error('Load failed', e);
    toast('Could not connect to server', 'error');
  }
}

/* ─── Navigation ────────────────────────────────────────────────────────── */
function navTo(view, skipReset = false) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById('view-' + view).classList.add('active');
  document.querySelector(`[data-view="${view}"]`)?.classList.add('active');
  currentView = view;

  const titles = { new: 'New Invoice', list: 'All Invoices', dashboard: 'Dashboard' };
  document.getElementById('topbar-title').textContent = titles[view] || '';

  if (view === 'list') renderList();
  if (view === 'dashboard') renderDashboard();
  if (view === 'new' && !skipReset && !editingId) resetForm();
  closeSidebar();
}

function openSidebar()  { document.getElementById('sidebar').classList.add('open'); document.getElementById('overlay').classList.add('show'); }
function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('overlay').classList.remove('show'); }

/* ─── Form helpers ──────────────────────────────────────────────────────── */
function today() { return new Date().toISOString().split('T')[0]; }
function addDays(d, n) { const dt = new Date(d); dt.setDate(dt.getDate() + n); return dt.toISOString().split('T')[0]; }

function setDefaultDates() {
  document.getElementById('f-date').value = today();
  document.getElementById('f-due').value  = addDays(today(), 7);
}

function nextNum() {
  let max = 17;
  allInvoices.forEach(inv => {
    const n = parseInt((inv.num || '').replace(/\D/g, ''));
    if (n > max) max = n;
  });
  return 'BILL' + (max + 1);
}

function resetForm() {
  editingId = null;
  document.getElementById('form-heading').textContent = 'New Invoice';
  document.getElementById('f-num').value           = nextNum();
  document.getElementById('f-status').value        = 'pending';
  document.getElementById('f-client-name').value   = '';
  document.getElementById('f-client-phone').value  = '';
  document.getElementById('f-client-company').value= '';
  document.getElementById('f-notes').value         = '';
  setDefaultDates();
  document.getElementById('items-body').innerHTML  = '';
  addRow();
  calcTotal();
  renderSidebar();
}

function getFormData() {
  const items = [];
  document.querySelectorAll('.item-row').forEach(row => {
    const qty  = parseFloat(row.querySelector('.item-qty').value)  || 0;
    const desc = row.querySelector('.item-desc').value.trim();
    const rate = parseFloat(row.querySelector('.item-rate').value) || 0;
    if (desc || qty || rate) items.push({ qty, description: desc, rate });
  });
  return {
    num:            document.getElementById('f-num').value.trim(),
    date:           document.getElementById('f-date').value,
    due:            document.getElementById('f-due').value,
    status:         document.getElementById('f-status').value,
    client_name:    document.getElementById('f-client-name').value.trim(),
    client_phone:   document.getElementById('f-client-phone').value.trim(),
    client_company: document.getElementById('f-client-company').value.trim(),
    notes:          document.getElementById('f-notes').value.trim(),
    items,
  };
}

function loadFormData(inv) {
  editingId = inv.id;
  document.getElementById('form-heading').textContent = 'Editing ' + inv.num;
  document.getElementById('f-num').value            = inv.num            || '';
  document.getElementById('f-date').value           = inv.date           || today();
  document.getElementById('f-due').value            = inv.due            || addDays(today(), 7);
  document.getElementById('f-status').value         = inv.status         || 'pending';
  document.getElementById('f-client-name').value    = inv.client_name    || '';
  document.getElementById('f-client-phone').value   = inv.client_phone   || '';
  document.getElementById('f-client-company').value = inv.client_company || '';
  document.getElementById('f-notes').value          = inv.notes          || '';
  document.getElementById('items-body').innerHTML   = '';
  (inv.items || []).forEach(it => addRow(it.qty, it.description, it.rate));
  if (!inv.items?.length) addRow();
  calcTotal();
}

/* ─── Items ─────────────────────────────────────────────────────────────── */
function addRow(qty = '', desc = '', rate = '') {
  const row = document.createElement('div');
  row.className = 'item-row';
  row.innerHTML = `
    <input class="item-qty"  type="number" placeholder="1"   value="${qty}"  min="0" oninput="calcTotal()"/>
    <input class="item-desc" type="text"   placeholder="Description" value="${escHtml(String(desc))}" oninput="calcTotal()"/>
    <input class="item-rate" type="number" placeholder="0"   value="${rate}" min="0" oninput="calcTotal()"/>
    <div class="item-price">Rs 0</div>
    <button class="del-btn" onclick="this.closest('.item-row').remove();calcTotal()" aria-label="Remove">✕</button>
  `;
  document.getElementById('items-body').appendChild(row);
  calcTotal();
}

function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

function calcTotal() {
  let total = 0;
  document.querySelectorAll('.item-row').forEach(row => {
    const qty  = parseFloat(row.querySelector('.item-qty').value)  || 0;
    const rate = parseFloat(row.querySelector('.item-rate').value) || 0;
    const rowTotal = qty * rate;
    total += rowTotal;
    row.querySelector('.item-price').textContent = 'Rs ' + fmt(rowTotal);
  });
  document.getElementById('total-display').textContent = 'Rs ' + fmt(total);
}

/* ─── Save ──────────────────────────────────────────────────────────────── */
async function saveInvoice() {
  const btn = document.getElementById('save-btn');
  const data = getFormData();
  if (!data.num) { toast('Please enter an invoice number'); return; }

  btn.textContent = 'Saving…';
  btn.disabled = true;
  try {
    let saved;
    if (editingId) {
      saved = await apiFetch('/invoices/' + editingId, { method: 'PUT', body: JSON.stringify(data) });
      toast('Invoice updated ✓');
    } else {
      saved = await apiFetch('/invoices', { method: 'POST', body: JSON.stringify(data) });
      editingId = saved.id;
      document.getElementById('form-heading').textContent = 'Editing ' + saved.num;
      toast('Invoice saved ✓');
    }
    await loadAll();
  } catch (e) {
    toast('Save failed — is the server running?', 'error');
  } finally {
    btn.textContent = 'Save';
    btn.disabled = false;
  }
}

/* ─── Open invoice for editing ──────────────────────────────────────────── */
async function openInvoice(id) {
  try {
    const inv = await apiFetch('/invoices/' + id);
    loadFormData(inv);
    navTo('new', true);
    renderSidebar();
  } catch (e) {
    toast('Could not load invoice', 'error');
  }
}

/* ─── Delete ────────────────────────────────────────────────────────────── */
async function deleteInvoice(id, e) {
  e?.stopPropagation();
  if (!confirm('Delete this invoice? This cannot be undone.')) return;
  try {
    await apiFetch('/invoices/' + id, { method: 'DELETE' });
    if (editingId === id) resetForm();
    await loadAll();
    if (currentView === 'list') renderList();
    if (currentView === 'dashboard') renderDashboard();
    toast('Invoice deleted');
  } catch (e2) {
    toast('Delete failed', 'error');
  }
}

/* ─── Render sidebar ────────────────────────────────────────────────────── */
function renderSidebar() {
  const el = document.getElementById('recent-list');
  if (!allInvoices.length) {
    el.innerHTML = '<p style="font-size:12px;color:var(--text3);padding:8px 12px">No invoices yet</p>';
    return;
  }
  el.innerHTML = allInvoices.slice(0, 8).map(inv => `
    <div class="recent-item ${editingId === inv.id ? 'active' : ''}" onclick="openInvoice('${inv.id}')">
      <div class="ri-num">${inv.num || '—'}</div>
      <div class="ri-client">${inv.client_name || 'No client'}</div>
      <div class="ri-meta">
        <span class="ri-date">${inv.date || ''}</span>
        <span class="ri-amt">Rs ${fmt(inv.total || 0)}</span>
      </div>
    </div>
  `).join('');
}

/* ─── Render list ───────────────────────────────────────────────────────── */
function renderList() {
  const query = (document.getElementById('search-input')?.value || '').toLowerCase();
  const filtered = allInvoices.filter(inv =>
    !query ||
    (inv.num || '').toLowerCase().includes(query) ||
    (inv.client_name || '').toLowerCase().includes(query) ||
    (inv.client_company || '').toLowerCase().includes(query)
  );
  const el = document.getElementById('list-body');
  if (!filtered.length) {
    el.innerHTML = `<div class="empty-state"><div class="es-icon">📄</div><p>${query ? 'No results found' : 'No invoices yet'}</p></div>`;
    return;
  }
  const rows = filtered.map(inv => `
    <tr onclick="openInvoice('${inv.id}')">
      <td class="inv-num-cell">${inv.num || '—'}</td>
      <td class="client-cell">
        ${inv.client_name || '—'}
        ${inv.client_company ? `<div class="company">${inv.client_company}</div>` : ''}
      </td>
      <td>${inv.date || '—'}</td>
      <td>${inv.due || '—'}</td>
      <td class="amt-cell">Rs ${fmt(inv.total || 0)}</td>
      <td><span class="badge badge-${inv.status}">${inv.status === 'paid' ? 'Paid' : 'Pending'}</span></td>
      <td class="actions-cell">
        <button class="btn btn-sm btn-secondary" onclick="exportPDFById('${inv.id}', event)" title="PDF">PDF</button>
        <button class="btn btn-sm btn-danger" onclick="deleteInvoice('${inv.id}', event)" title="Delete">Delete</button>
      </td>
    </tr>
  `).join('');

  const cards = filtered.map(inv => `
    <div class="list-card" onclick="openInvoice('${inv.id}')">
      <div class="lc-top">
        <div>
          <div class="lc-num">${inv.num || '—'}</div>
          <div class="lc-client">${inv.client_name || 'No client'}</div>
          ${inv.client_company ? `<div class="lc-company">${inv.client_company}</div>` : ''}
        </div>
        <div class="lc-amt">Rs ${fmt(inv.total || 0)}</div>
      </div>
      <div class="lc-bottom">
        <div>
          <span class="badge badge-${inv.status}">${inv.status === 'paid' ? 'Paid' : 'Pending'}</span>
          <span class="lc-date" style="margin-left:8px">${inv.date || ''}</span>
        </div>
        <div class="lc-actions">
          <button class="btn btn-sm btn-secondary" onclick="exportPDFById('${inv.id}', event)">PDF</button>
          <button class="btn btn-sm btn-danger" onclick="deleteInvoice('${inv.id}', event)">Delete</button>
        </div>
      </div>
    </div>
  `).join('');

  el.innerHTML = `
    <table class="list-table">
      <thead><tr>
        <th>Invoice #</th><th>Client</th><th>Date</th><th>Due</th>
        <th style="text-align:right">Amount</th><th>Status</th><th></th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="list-cards">${cards}</div>
  `;
}

function filterList() { renderList(); }

/* ─── Dashboard ─────────────────────────────────────────────────────────── */
async function renderDashboard() {
  try {
    const stats = await apiFetch('/stats');
    document.getElementById('stats-grid').innerHTML = `
      <div class="stat-card"><div class="stat-label">Total invoices</div><div class="stat-value blue">${stats.total_invoices}</div></div>
      <div class="stat-card"><div class="stat-label">Total revenue</div><div class="stat-value">Rs ${fmt(stats.total_revenue)}</div></div>
      <div class="stat-card"><div class="stat-label">Paid</div><div class="stat-value green">${stats.paid}</div></div>
      <div class="stat-card"><div class="stat-label">Pending</div><div class="stat-value amber">${stats.pending}</div></div>
    `;
    const recent = allInvoices.slice(0, 8);
    document.getElementById('dash-recent').innerHTML = recent.length
      ? recent.map(inv => `
          <div class="dash-row" onclick="openInvoice('${inv.id}')">
            <span class="dr-num">${inv.num}</span>
            <span class="dr-client">${inv.client_name || '—'}${inv.client_company ? ' · ' + inv.client_company : ''}</span>
            <span class="badge badge-${inv.status}" style="margin-right:8px">${inv.status}</span>
            <span class="dr-amt">Rs ${fmt(inv.total || 0)}</span>
          </div>
        `).join('')
      : '<p style="color:var(--text3);font-size:13px;padding:16px 0">No invoices yet.</p>';
  } catch (e) {
    document.getElementById('stats-grid').innerHTML = '<p style="color:var(--text3)">Could not load stats.</p>';
  }
}

/* ─── PDF Export ─────────────────────────────────────────────────────────── */
function buildPDF(inv) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 20;

  // Header bar
  doc.setFillColor(24, 95, 165);
  doc.rect(0, 0, W, 14, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont(undefined, 'bold'); doc.setFontSize(15);
  doc.text('INVOICE', M, 9.5);
  doc.setFont(undefined, 'normal'); doc.setFontSize(9);
  doc.text(inv.num || '', W - M, 9.5, { align: 'right' });

  // FROM block
  doc.setTextColor(30, 30, 30);
  doc.setFont(undefined, 'bold'); doc.setFontSize(9);
  doc.text('FROM', M, 24);
  doc.setFont(undefined, 'normal');
  ['H&CO.', 'Plot #6 Canal Road Jallo, Near SOZO Parking', 'Lahore', '+92 321 8841506  ·  +92 42 36525893', 'hncostores@gmail.com']
    .forEach((line, i) => doc.text(line, M, 29 + i * 4.5));

  // BILL TO block
  doc.setFont(undefined, 'bold'); doc.setFontSize(9);
  doc.text('BILL TO', 110, 24);
  doc.setFont(undefined, 'normal');
  const billLines = [inv.client_name, inv.client_company, inv.client_phone].filter(Boolean);
  billLines.forEach((line, i) => doc.text(line, 110, 29 + i * 4.5));

  // Dates & status (right side)
  const metaX = W - M;
  [['Issue Date', inv.date || ''], ['Due Date', inv.due || '']].forEach(([k, v], i) => {
    doc.setFont(undefined, 'bold'); doc.text(k + ':', metaX - 42, 24 + i * 5);
    doc.setFont(undefined, 'normal'); doc.text(v, metaX, 24 + i * 5, { align: 'right' });
  });
  doc.setFont(undefined, 'bold'); doc.text('Status:', metaX - 42, 34);
  if (inv.status === 'paid') doc.setTextColor(59, 109, 17); else doc.setTextColor(186, 117, 11);
  doc.setFont(undefined, 'normal'); doc.text((inv.status || 'pending').toUpperCase(), metaX, 34, { align: 'right' });
  doc.setTextColor(30, 30, 30);

  // Table header
  let y = 56;
  doc.setFillColor(24, 95, 165);
  doc.rect(M, y, W - M * 2, 7, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont(undefined, 'bold'); doc.setFontSize(8.5);
  doc.text('QTY',        M + 2, y + 5);
  doc.text('DESCRIPTION', M + 18, y + 5);
  doc.text('RATE',        148, y + 5, { align: 'right' });
  doc.text('ITEM PRICE',  W - M, y + 5, { align: 'right' });

  doc.setTextColor(30, 30, 30); doc.setFont(undefined, 'normal'); doc.setFontSize(9);
  y += 9;

  (inv.items || []).forEach((it, i) => {
    if (i % 2 === 0) { doc.setFillColor(240, 246, 252); doc.rect(M, y - 1, W - M * 2, 7, 'F'); }
    const itemPrice = (it.qty || 0) * (it.rate || 0);
    doc.text(String(it.qty || 0),          M + 2, y + 4);
    doc.text(it.description || '',          M + 18, y + 4);
    doc.text('Rs ' + fmt(it.rate || 0),    148, y + 4, { align: 'right' });
    doc.text('Rs ' + fmt(itemPrice),        W - M, y + 4, { align: 'right' });
    y += 8;
  });

  // Total
  y += 4;
  doc.setDrawColor(200, 200, 200); doc.line(M, y, W - M, y); y += 7;
  doc.setFont(undefined, 'bold'); doc.setFontSize(11);
  doc.text('TOTAL', 148, y, { align: 'right' });
  doc.setTextColor(24, 95, 165);
  const total = (inv.items || []).reduce((s, it) => s + (it.qty || 0) * (it.rate || 0), 0);
  doc.text('Rs ' + fmt(total), W - M, y, { align: 'right' });

  // Notes
  if (inv.notes) {
    y += 12;
    doc.setTextColor(110, 110, 110); doc.setFontSize(8.5); doc.setFont(undefined, 'italic');
    doc.text('Note: ' + inv.notes, M, y);
  }

  // Footer
  doc.setTextColor(170, 170, 170); doc.setFontSize(8); doc.setFont(undefined, 'normal');
  doc.text('H&CO.  ·  hncostores@gmail.com  ·  +92 321 8841506  ·  Canal Road Jallo, Lahore', W / 2, 287, { align: 'center' });

  return doc;
}

async function exportPDF() {
  await saveInvoice();
  const inv = editingId ? await apiFetch('/invoices/' + editingId) : null;
  if (!inv) { toast('Save first, then export'); return; }
  buildPDF(inv).save((inv.num || 'invoice') + '.pdf');
  toast('PDF downloaded ✓');
}

async function exportPDFById(id, e) {
  e?.stopPropagation();
  try {
    const inv = await apiFetch('/invoices/' + id);
    buildPDF(inv).save((inv.num || 'invoice') + '.pdf');
    toast('PDF downloaded ✓');
  } catch (err) {
    toast('Could not export PDF', 'error');
  }
}

/* ─── Utils ─────────────────────────────────────────────────────────────── */
function fmt(n) { return Number(n).toLocaleString('en-PK'); }

function toast(msg, type = 'ok') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.background = type === 'error' ? '#A32D2D' : '#1A1D23';
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}
