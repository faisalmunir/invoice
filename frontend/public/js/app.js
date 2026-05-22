const API = '/api';
let allInvoices = [];
let editingId   = null;
let currentView = 'new';

document.addEventListener('DOMContentLoaded', async () => {
  setDefaultDates();
  document.getElementById('pay-date').value = today();
  await loadAll();
  resetForm();
});

/* ─── API ─────────────────────────────────────────────────────────────────── */
async function apiFetch(path, opts = {}) {
  const res = await fetch(API + path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

function normalise(inv) {
  if (!inv) return inv;
  inv.id = inv.id || inv._id;
  (inv.items    || []).forEach(it  => { it.id  = it.id  || it._id; });
  (inv.payments || []).forEach(pay => { pay.id = pay.id || pay._id; });
  return inv;
}

async function loadAll() {
  try {
    allInvoices = (await apiFetch('/invoices')).map(normalise);
    renderSidebar();
  } catch(e) { toast('Could not connect to server', 'error'); }
}

/* ─── Nav ─────────────────────────────────────────────────────────────────── */
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
function openSidebar()  { document.getElementById('sidebar').classList.add('open');    document.getElementById('overlay').classList.add('show'); }
function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('overlay').classList.remove('show'); }

/* ─── Form ────────────────────────────────────────────────────────────────── */
function today() { return new Date().toISOString().split('T')[0]; }
function addDays(d, n) { const dt = new Date(d); dt.setDate(dt.getDate() + n); return dt.toISOString().split('T')[0]; }
function setDefaultDates() { document.getElementById('f-date').value = today(); document.getElementById('f-due').value = addDays(today(), 7); }

function nextNum() {
  let max = 17;
  allInvoices.forEach(inv => { const n = parseInt((inv.num||'').replace(/\D/g,'')); if (n > max) max = n; });
  const year = new Date().getFullYear(); return 'HC-' + year + '-' + String(max + 1).padStart(3, '0');
}

function resetForm() {
  editingId = null;
  document.getElementById('form-heading').textContent = 'New Invoice';
  document.getElementById('f-num').value            = nextNum();
  document.getElementById('f-status').value         = 'pending';
  document.getElementById('f-client-name').value    = '';
  document.getElementById('f-client-phone').value   = '';
  document.getElementById('f-client-company').value = '';
  document.getElementById('f-notes').value          = '';
  setDefaultDates();
  document.getElementById('items-body').innerHTML   = '';
  document.getElementById('payment-card').style.display = 'none';
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
  renderPaymentSection(inv);
}

/* ─── Items ───────────────────────────────────────────────────────────────── */
function addRow(qty='', desc='', rate='') {
  const row = document.createElement('div');
  row.className = 'item-row';
  row.innerHTML = `
    <input class="item-qty"  type="number" placeholder="1"   value="${qty}"  min="0" oninput="calcTotal()"/>
    <input class="item-desc" type="text"   placeholder="Description" value="${esc(String(desc))}" oninput="calcTotal()"/>
    <input class="item-rate" type="number" placeholder="0"   value="${rate}" min="0" oninput="calcTotal()"/>
    <div class="item-price">Rs 0</div>
    <button class="del-btn" onclick="this.closest('.item-row').remove();calcTotal()" aria-label="Remove">✕</button>`;
  document.getElementById('items-body').appendChild(row);
  calcTotal();
}

function esc(s) { return s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

function calcTotal() {
  let total = 0;
  document.querySelectorAll('.item-row').forEach(row => {
    const qty  = parseFloat(row.querySelector('.item-qty').value)  || 0;
    const rate = parseFloat(row.querySelector('.item-rate').value) || 0;
    const rt   = qty * rate;
    total += rt;
    row.querySelector('.item-price').textContent = 'Rs ' + fmt(rt);
  });
  document.getElementById('total-display').textContent = 'Rs ' + fmt(total);
}

/* ─── Payment Section ─────────────────────────────────────────────────────── */
function renderPaymentSection(inv) {
  const card = document.getElementById('payment-card');
  if (!inv.id) { card.style.display = 'none'; return; }
  card.style.display = '';

  const total     = inv.total     || 0;
  const totalPaid = inv.totalPaid || 0;
  const remaining = inv.remaining ?? (total - totalPaid);
  const pct       = total > 0 ? Math.min(100, Math.round(totalPaid / total * 100)) : 0;

  document.getElementById('payment-summary').innerHTML = `
    <div class="ps-box">
      <div class="ps-label">Invoice total</div>
      <div class="ps-value blue">Rs ${fmt(total)}</div>
    </div>
    <div class="ps-box">
      <div class="ps-label">Total paid</div>
      <div class="ps-value green">Rs ${fmt(totalPaid)}</div>
      <div class="progress-wrap"><div class="progress-bar" style="width:${pct}%"></div></div>
    </div>
    <div class="ps-box">
      <div class="ps-label">Remaining</div>
      <div class="ps-value ${remaining <= 0 ? 'green' : 'red'}">Rs ${fmt(Math.max(0, remaining))}</div>
    </div>`;

  const pays = inv.payments || [];
  document.getElementById('payment-history').innerHTML = pays.length
    ? pays.map(p => `
        <div class="payment-row">
          <span class="pay-date">${p.date || ''}</span>
          <span class="pay-note">${p.note || '—'}</span>
          <span class="pay-amount">+ Rs ${fmt(p.amount)}</span>
          <button class="btn btn-sm btn-danger pay-del" onclick="deletePayment('${p.id}')">✕</button>
        </div>`).join('')
    : '<div class="no-payments">No payments recorded yet</div>';
}

/* ─── Add Payment ─────────────────────────────────────────────────────────── */
async function addPayment() {
  if (!editingId) { toast('Save the invoice first', 'error'); return; }
  const amount = parseFloat(document.getElementById('pay-amount').value);
  const date   = document.getElementById('pay-date').value || today();
  const note   = document.getElementById('pay-note').value.trim();

  if (!amount || amount <= 0) { toast('Enter a valid amount', 'error'); return; }

  try {
    const inv = normalise(await apiFetch(`/invoices/${editingId}/payments`, {
      method: 'POST', body: JSON.stringify({ amount, date, note })
    }));
    // Update status dropdown to reflect auto-update
    document.getElementById('f-status').value = inv.status;
    renderPaymentSection(inv);
    // Clear inputs
    document.getElementById('pay-amount').value = '';
    document.getElementById('pay-note').value   = '';
    document.getElementById('pay-date').value   = today();
    await loadAll();
    toast('Payment added ✓');
  } catch(e) { toast('Failed to add payment', 'error'); }
}

/* ─── Delete Payment ──────────────────────────────────────────────────────── */
async function deletePayment(payId) {
  if (!confirm('Remove this payment?')) return;
  try {
    const inv = normalise(await apiFetch(`/payments/${payId}`, { method: 'DELETE' }));
    document.getElementById('f-status').value = inv.status;
    renderPaymentSection(inv);
    await loadAll();
    toast('Payment removed');
  } catch(e) { toast('Failed to remove payment', 'error'); }
}

/* ─── Save Invoice ────────────────────────────────────────────────────────── */
async function saveInvoice() {
  const data = getFormData();
  if (!data.num) { toast('Please enter an invoice number'); return null; }
  const btn = document.getElementById('save-btn');
  btn.textContent = 'Saving…'; btn.disabled = true;
  try {
    let saved;
    if (editingId) {
      saved = normalise(await apiFetch('/invoices/' + editingId, { method: 'PUT', body: JSON.stringify(data) }));
      toast('Invoice updated ✓');
    } else {
      saved = normalise(await apiFetch('/invoices', { method: 'POST', body: JSON.stringify(data) }));
      editingId = saved.id;
      document.getElementById('form-heading').textContent = 'Editing ' + saved.num;
      renderPaymentSection(saved);
      toast('Invoice saved ✓');
    }
    await loadAll();
    return saved;
  } catch(e) { toast('Save failed', 'error'); return null; }
  finally { btn.textContent = 'Save'; btn.disabled = false; }
}

/* ─── Open Invoice ────────────────────────────────────────────────────────── */
async function openInvoice(id) {
  try {
    const inv = normalise(await apiFetch('/invoices/' + id));
    loadFormData(inv);
    navTo('new', true);
    renderSidebar();
  } catch(e) { toast('Could not load invoice', 'error'); }
}

/* ─── Delete Invoice ──────────────────────────────────────────────────────── */
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
  } catch(e2) { toast('Delete failed', 'error'); }
}

/* ─── Sidebar ─────────────────────────────────────────────────────────────── */
function renderSidebar() {
  const el = document.getElementById('recent-list');
  if (!allInvoices.length) { el.innerHTML = '<p style="font-size:12px;color:var(--text3);padding:8px 12px">No invoices yet</p>'; return; }
  el.innerHTML = allInvoices.slice(0, 8).map(inv => `
    <div class="recent-item ${editingId === inv.id ? 'active' : ''}" onclick="openInvoice('${inv.id}')">
      <div class="ri-num">${inv.num || '—'}</div>
      <div class="ri-client">${inv.client_name || 'No client'}</div>
      <div class="ri-meta">
        <span class="ri-date">${inv.date || ''}</span>
        <span class="ri-amt">Rs ${fmt(inv.remaining > 0 ? inv.remaining : inv.total || 0)}</span>
      </div>
    </div>`).join('');
}

/* ─── List View ───────────────────────────────────────────────────────────── */
function renderList() {
  const query = (document.getElementById('search-input')?.value || '').toLowerCase();
  const filtered = allInvoices.filter(inv =>
    !query || (inv.num||'').toLowerCase().includes(query) ||
    (inv.client_name||'').toLowerCase().includes(query) ||
    (inv.client_company||'').toLowerCase().includes(query));
  const el = document.getElementById('list-body');
  if (!filtered.length) { el.innerHTML = `<div class="empty-state"><div class="es-icon">📄</div><p>${query ? 'No results' : 'No invoices yet'}</p></div>`; return; }

  const rows = filtered.map(inv => {
    const rem = inv.remaining ?? (inv.total - inv.totalPaid);
    return `<tr onclick="openInvoice('${inv.id}')">
      <td class="inv-num-cell">${inv.num||'—'}</td>
      <td class="client-cell">${inv.client_name||'—'}${inv.client_company?`<div class="company">${inv.client_company}</div>`:''}</td>
      <td>${inv.date||'—'}</td>
      <td class="amt-cell">Rs ${fmt(inv.total||0)}</td>
      <td class="remaining-cell"><span class="${rem <= 0 ? 'remaining-zero' : 'remaining-pos'}">Rs ${fmt(Math.max(0,rem))}</span></td>
      <td><span class="badge badge-${inv.status}">${statusLabel(inv.status)}</span></td>
      <td class="actions-cell">
        <button class="btn btn-sm btn-secondary" onclick="exportPDFById('${inv.id}',event)">PDF</button>
        <button class="btn btn-sm btn-danger" onclick="deleteInvoice('${inv.id}',event)">Delete</button>
      </td>
    </tr>`;
  }).join('');

  const cards = filtered.map(inv => {
    const rem = inv.remaining ?? (inv.total - inv.totalPaid);
    return `<div class="list-card" onclick="openInvoice('${inv.id}')">
      <div class="lc-top">
        <div><div class="lc-num">${inv.num||'—'}</div><div class="lc-client">${inv.client_name||'No client'}</div>${inv.client_company?`<div class="lc-company">${inv.client_company}</div>`:''}</div>
        <div><div class="lc-amt">Rs ${fmt(inv.total||0)}</div><div class="lc-remaining ${rem<=0?'remaining-zero':'remaining-pos'}" style="font-size:12px;text-align:right">Rem: Rs ${fmt(Math.max(0,rem))}</div></div>
      </div>
      <div class="lc-bottom">
        <div><span class="badge badge-${inv.status}">${statusLabel(inv.status)}</span><span class="lc-date" style="margin-left:8px">${inv.date||''}</span></div>
        <div class="lc-actions">
          <button class="btn btn-sm btn-secondary" onclick="exportPDFById('${inv.id}',event)">PDF</button>
          <button class="btn btn-sm btn-danger" onclick="deleteInvoice('${inv.id}',event)">Delete</button>
        </div>
      </div>
    </div>`;
  }).join('');

  el.innerHTML = `
    <table class="list-table">
      <thead><tr><th>Invoice #</th><th>Client</th><th>Date</th><th style="text-align:right">Total</th><th style="text-align:right">Remaining</th><th>Status</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="list-cards">${cards}</div>`;
}

function filterList() { renderList(); }

/* ─── Dashboard ───────────────────────────────────────────────────────────── */
async function renderDashboard() {
  try {
    const s = await apiFetch('/stats');
    document.getElementById('stats-grid').innerHTML = `
      <div class="stat-card"><div class="stat-label">Total invoices</div><div class="stat-value blue">${s.total_invoices}</div></div>
      <div class="stat-card"><div class="stat-label">Total billed</div><div class="stat-value">Rs ${fmt(s.total_revenue)}</div></div>
      <div class="stat-card"><div class="stat-label">Total received</div><div class="stat-value green">Rs ${fmt(s.total_paid)}</div></div>
      <div class="stat-card"><div class="stat-label">Still owed</div><div class="stat-value red">Rs ${fmt(s.total_remaining)}</div></div>
      <div class="stat-card"><div class="stat-label">Paid invoices</div><div class="stat-value green">${s.paid}</div></div>
      <div class="stat-card"><div class="stat-label">Partial</div><div class="stat-value orange">${s.partial}</div></div>
      <div class="stat-card"><div class="stat-label">Pending</div><div class="stat-value amber">${s.pending}</div></div>`;

    const unpaid = allInvoices.filter(i => i.status !== 'paid').slice(0, 10);
    document.getElementById('dash-recent').innerHTML = unpaid.length
      ? unpaid.map(inv => {
          const rem = inv.remaining ?? (inv.total - inv.totalPaid);
          return `<div class="dash-row" onclick="openInvoice('${inv.id}')">
            <span class="dr-num">${inv.num}</span>
            <span class="dr-client">${inv.client_name||'—'}${inv.client_company?' · '+inv.client_company:''}</span>
            <span class="badge badge-${inv.status}">${statusLabel(inv.status)}</span>
            <span class="dr-remaining">Rs ${fmt(Math.max(0,rem))}</span>
          </div>`;
        }).join('')
      : '<p style="color:var(--text3);font-size:13px;padding:16px 0">All invoices are paid! 🎉</p>';
  } catch(e) { document.getElementById('stats-grid').innerHTML = '<p style="color:var(--text3)">Could not load stats.</p>'; }
}

/* ─── PDF Export ──────────────────────────────────────────────────────────── */
function buildPDF(inv) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 20;

  doc.setFillColor(24,95,165); doc.rect(0,0,W,14,'F');
  doc.setTextColor(255,255,255); doc.setFont(undefined,'bold'); doc.setFontSize(15);
  doc.text('INVOICE', M, 9.5);
  doc.setFont(undefined,'normal'); doc.setFontSize(9);
  doc.text(inv.num||'', W-M, 9.5, {align:'right'});

  doc.setTextColor(30,30,30); doc.setFont(undefined,'bold'); doc.setFontSize(9);
  doc.text('FROM', M, 24); doc.setFont(undefined,'normal');
  ['H&CO.','Plot #6 Canal Road Jallo, Near SOZO Parking','Lahore','+92 321 8841506  ·  +92 42 36525893','hncostores@gmail.com']
    .forEach((l,i) => doc.text(l, M, 29+i*4.5));

  doc.setFont(undefined,'bold'); doc.text('BILL TO', 110, 24); doc.setFont(undefined,'normal');
  [inv.client_name, inv.client_company, inv.client_phone].filter(Boolean).forEach((l,i) => doc.text(l, 110, 29+i*4.5));

  [['Issue Date', inv.date||''],['Due Date', inv.due||'']].forEach(([k,v],i) => {
    doc.setFont(undefined,'bold'); doc.text(k+':', W-M-42, 24+i*5);
    doc.setFont(undefined,'normal'); doc.text(v, W-M, 24+i*5, {align:'right'});
  });
  doc.setFont(undefined,'bold'); doc.text('Status:', W-M-42, 34);
  doc.setTextColor(inv.status==='paid'?59:inv.status==='partial'?192:186, inv.status==='paid'?109:inv.status==='partial'?92:117, inv.status==='paid'?17:11);
  doc.setFont(undefined,'normal'); doc.text(statusLabel(inv.status).toUpperCase(), W-M, 34, {align:'right'});
  doc.setTextColor(30,30,30);

  let y = 56;
  doc.setFillColor(24,95,165); doc.rect(M,y,W-M*2,7,'F');
  doc.setTextColor(255,255,255); doc.setFont(undefined,'bold'); doc.setFontSize(8.5);
  doc.text('QTY', M+2, y+5); doc.text('DESCRIPTION', M+18, y+5);
  doc.text('RATE', 148, y+5, {align:'right'}); doc.text('ITEM PRICE', W-M, y+5, {align:'right'});

  doc.setTextColor(30,30,30); doc.setFont(undefined,'normal'); doc.setFontSize(9); y+=9;
  (inv.items||[]).forEach((it,i) => {
    if(i%2===0){doc.setFillColor(240,246,252);doc.rect(M,y-1,W-M*2,7,'F');}
    doc.text(String(it.qty||0), M+2, y+4);
    doc.text(it.description||'', M+18, y+4);
    doc.text('Rs '+fmt(it.rate||0), 148, y+4, {align:'right'});
    doc.text('Rs '+fmt((it.qty||0)*(it.rate||0)), W-M, y+4, {align:'right'});
    y+=8;
  });

  const total = (inv.items||[]).reduce((s,it)=>s+(it.qty||0)*(it.rate||0),0);
  y+=4; doc.setDrawColor(200,200,200); doc.line(M,y,W-M,y); y+=7;
  doc.setFont(undefined,'bold'); doc.setFontSize(11);
  doc.text('TOTAL', 148, y, {align:'right'});
  doc.setTextColor(24,95,165);
  doc.text('Rs '+fmt(total), W-M, y, {align:'right'});
  doc.setTextColor(30,30,30); y+=10;

  // Payment history in PDF
  const pays = inv.payments||[];
  if (pays.length) {
    y+=4;
    doc.setFillColor(245,248,252); doc.rect(M,y,W-M*2,7,'F');
    doc.setFont(undefined,'bold'); doc.setFontSize(8.5); doc.setTextColor(24,95,165);
    doc.text('PAYMENT HISTORY', M+2, y+5);
    doc.setTextColor(30,30,30); doc.setFont(undefined,'normal'); y+=9;
    pays.forEach((p,i) => {
      if(i%2===0){doc.setFillColor(250,252,255);doc.rect(M,y-1,W-M*2,6,'F');}
      doc.text(p.date||'', M+2, y+3.5);
      doc.text(p.note||'—', M+30, y+3.5);
      doc.setTextColor(59,109,17); doc.text('Rs '+fmt(p.amount), W-M, y+3.5, {align:'right'});
      doc.setTextColor(30,30,30); y+=7;
    });
    const totalPaid = pays.reduce((s,p)=>s+(p.amount||0),0);
    const remaining = total - totalPaid;
    y+=2; doc.setDrawColor(200,200,200); doc.line(M,y,W-M,y); y+=6;
    doc.setFont(undefined,'bold'); doc.setFontSize(10);
    doc.text('TOTAL PAID', 148, y, {align:'right'});
    doc.setTextColor(59,109,17); doc.text('Rs '+fmt(totalPaid), W-M, y, {align:'right'});
    y+=7;
    doc.setTextColor(30,30,30); doc.text('REMAINING', 148, y, {align:'right'});
    doc.setTextColor(remaining<=0?59:186, remaining<=0?109:45, remaining<=0?17:11);
    doc.text('Rs '+fmt(Math.max(0,remaining)), W-M, y, {align:'right'});
  }

  if (inv.notes) {
    y+=12; doc.setTextColor(110,110,110); doc.setFontSize(8.5); doc.setFont(undefined,'italic');
    doc.text('Note: '+inv.notes, M, y);
  }

  doc.setTextColor(170,170,170); doc.setFontSize(8); doc.setFont(undefined,'normal');
  doc.text('H&CO.  ·  hncostores@gmail.com  ·  +92 321 8841506  ·  Canal Road Jallo, Lahore', W/2, 287, {align:'center'});
  return doc;
}

async function exportPDF() {
  const btn = document.getElementById('pdf-btn');
  btn.textContent = 'Exporting…'; btn.disabled = true;
  try {
    const saved = await saveInvoice();
    const id = editingId || (saved && saved.id);
    if (!id) { toast('Save invoice first', 'error'); return; }
    const inv = normalise(await apiFetch('/invoices/' + id));
    buildPDF(inv).save((inv.num||'invoice')+'.pdf');
    toast('PDF downloaded ✓');
  } catch(e) { toast('Export failed', 'error'); }
  finally { btn.textContent = 'Export PDF'; btn.disabled = false; }
}

async function exportPDFById(id, e) {
  e?.stopPropagation();
  try {
    const inv = normalise(await apiFetch('/invoices/' + id));
    buildPDF(inv).save((inv.num||'invoice')+'.pdf');
    toast('PDF downloaded ✓');
  } catch(e) { toast('Could not export PDF', 'error'); }
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function fmt(n) { return Number(n).toLocaleString('en-PK'); }
function statusLabel(s) { return s==='paid'?'Paid':s==='partial'?'Partially Paid':'Pending'; }

function toast(msg, type='ok') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.background = type==='error' ? '#A32D2D' : '#1A1D23';
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}
