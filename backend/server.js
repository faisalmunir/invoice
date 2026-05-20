const express = require('express');
const Datastore = require('nedb-promises');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_DIR = process.env.DB_DIR || __dirname;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/public')));
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));

// ─── Database ─────────────────────────────────────────────────────────────────
const invoices = Datastore.create({ filename: path.join(DB_DIR, 'invoices.db'), autoload: true });
const items    = Datastore.create({ filename: path.join(DB_DIR, 'items.db'),    autoload: true });

invoices.ensureIndex({ fieldName: 'createdAt' });

// ─── Seed demo data ───────────────────────────────────────────────────────────
async function seed() {
  const count = await invoices.count({});
  if (count === 0) {
    const inv = await invoices.insert({
      _id: 'demo1', num: 'BILL18', date: '2026-05-16', due: '2026-05-23',
      status: 'pending', client_name: 'NASIR', client_phone: '0322 4375044',
      client_company: 'SOZO Water Park', notes: '', createdAt: Date.now() - 86400000
    });
    await items.insert({ invoiceId: 'demo1', sortOrder: 0, qty: 44, description: 'Life Jacket Repairing', rate: 450 });
  }
}
seed();

// ─── Helpers ──────────────────────────────────────────────────────────────────
function genId() { return 'inv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }

async function getInvoice(id) {
  const inv = await invoices.findOne({ _id: id });
  if (!inv) return null;
  inv.items = await items.find({ invoiceId: id }).sort({ sortOrder: 1 });
  inv.total = inv.items.reduce((s, it) => s + (it.qty || 0) * (it.rate || 0), 0);
  return inv;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// List all
app.get('/api/invoices', async (req, res) => {
  try {
    const all = await invoices.find({}).sort({ createdAt: -1 });
    // attach totals
    for (const inv of all) {
      const its = await items.find({ invoiceId: inv._id });
      inv.total = its.reduce((s, it) => s + (it.qty || 0) * (it.rate || 0), 0);
    }
    res.json(all);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get one
app.get('/api/invoices/:id', async (req, res) => {
  try {
    const inv = await getInvoice(req.params.id);
    if (!inv) return res.status(404).json({ error: 'Not found' });
    res.json(inv);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Create
app.post('/api/invoices', async (req, res) => {
  try {
    const { num, date, due, status, client_name, client_phone, client_company, notes, items: rowItems } = req.body;
    const id = genId();
    const inv = await invoices.insert({
      _id: id, num: num||'', date: date||'', due: due||'',
      status: status||'pending', client_name: client_name||'',
      client_phone: client_phone||'', client_company: client_company||'',
      notes: notes||'', createdAt: Date.now()
    });
    for (let i = 0; i < (rowItems||[]).length; i++) {
      const it = rowItems[i];
      await items.insert({ invoiceId: id, sortOrder: i, qty: it.qty||0, description: it.description||'', rate: it.rate||0 });
    }
    res.status(201).json(await getInvoice(id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Update
app.put('/api/invoices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { num, date, due, status, client_name, client_phone, client_company, notes, items: rowItems } = req.body;
    const n = await invoices.update({ _id: id }, { $set: {
      num: num||'', date: date||'', due: due||'', status: status||'pending',
      client_name: client_name||'', client_phone: client_phone||'',
      client_company: client_company||'', notes: notes||''
    }});
    if (!n) return res.status(404).json({ error: 'Not found' });
    await items.remove({ invoiceId: id }, { multi: true });
    for (let i = 0; i < (rowItems||[]).length; i++) {
      const it = rowItems[i];
      await items.insert({ invoiceId: id, sortOrder: i, qty: it.qty||0, description: it.description||'', rate: it.rate||0 });
    }
    res.json(await getInvoice(id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete
app.delete('/api/invoices/:id', async (req, res) => {
  try {
    const n = await invoices.remove({ _id: req.params.id });
    if (!n) return res.status(404).json({ error: 'Not found' });
    await items.remove({ invoiceId: req.params.id }, { multi: true });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Stats
app.get('/api/stats', async (req, res) => {
  try {
    const all = await invoices.find({});
    let total_revenue = 0;
    for (const inv of all) {
      const its = await items.find({ invoiceId: inv._id });
      total_revenue += its.reduce((s, it) => s + (it.qty||0)*(it.rate||0), 0);
    }
    const pending = all.filter(i => i.status === 'pending').length;
    const paid    = all.filter(i => i.status === 'paid').length;
    res.json({ total_invoices: all.length, total_revenue, pending, paid });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

app.listen(PORT, () => console.log(`✅  H&CO Invoices running → http://localhost:${PORT}`));
