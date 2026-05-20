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
const db = {
  inv:   Datastore.create({ filename: path.join(DB_DIR, 'invoices.db'), autoload: true }),
  items: Datastore.create({ filename: path.join(DB_DIR, 'items.db'),    autoload: true }),
};
db.inv.ensureIndex({ fieldName: 'createdAt' });

// ─── Seed ─────────────────────────────────────────────────────────────────────
(async () => {
  if (await db.inv.count({}) === 0) {
    await db.inv.insert({ _id:'demo1', num:'BILL18', date:'2026-05-16', due:'2026-05-23',
      status:'pending', client_name:'NASIR', client_phone:'0322 4375044',
      client_company:'SOZO Water Park', notes:'', createdAt: Date.now() - 86400000 });
    await db.items.insert({ invoiceId:'demo1', sortOrder:0, qty:44, description:'Life Jacket Repairing', rate:450 });
  }
})();

// ─── Helpers ──────────────────────────────────────────────────────────────────
const genId = () => 'inv_' + Date.now() + '_' + Math.random().toString(36).slice(2,7);

async function getInvoice(id) {
  const inv = await db.inv.findOne({ _id: id });
  if (!inv) return null;
  inv.items = await db.items.find({ invoiceId: id }).sort({ sortOrder: 1 });
  inv.total = inv.items.reduce((s, it) => s + (it.qty||0) * (it.rate||0), 0);
  return inv;
}

async function replaceItems(invoiceId, rowItems) {
  await db.items.remove({ invoiceId }, { multi: true });
  for (let i = 0; i < (rowItems||[]).length; i++) {
    const it = rowItems[i];
    await db.items.insert({ invoiceId, sortOrder: i, qty: it.qty||0, description: it.description||'', rate: it.rate||0 });
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// List all
app.get('/api/invoices', async (req, res) => {
  try {
    const all = await db.inv.find({}).sort({ createdAt: -1 });
    for (const inv of all) {
      const its = await db.items.find({ invoiceId: inv._id });
      inv.total = its.reduce((s, it) => s + (it.qty||0)*(it.rate||0), 0);
    }
    res.json(all);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Get one
app.get('/api/invoices/:id', async (req, res) => {
  try {
    const inv = await getInvoice(req.params.id);
    if (!inv) return res.status(404).json({ error: 'Not found' });
    res.json(inv);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Create
app.post('/api/invoices', async (req, res) => {
  try {
    const { num, date, due, status, client_name, client_phone, client_company, notes, items: rowItems } = req.body;
    const id = genId();
    await db.inv.insert({ _id: id, num: num||'', date: date||'', due: due||'',
      status: status||'pending', client_name: client_name||'', client_phone: client_phone||'',
      client_company: client_company||'', notes: notes||'', createdAt: Date.now() });
    await replaceItems(id, rowItems);
    res.status(201).json(await getInvoice(id));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Update
app.put('/api/invoices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Check exists first
    const existing = await db.inv.findOne({ _id: id });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const { num, date, due, status, client_name, client_phone, client_company, notes, items: rowItems } = req.body;
    await db.inv.update({ _id: id }, { $set: {
      num: num||'', date: date||'', due: due||'', status: status||'pending',
      client_name: client_name||'', client_phone: client_phone||'',
      client_company: client_company||'', notes: notes||''
    }}, {});
    await replaceItems(id, rowItems);
    res.json(await getInvoice(id));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Delete  ← FIX: check existence first, then remove with {multi:false}
app.delete('/api/invoices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Verify it exists before trying to delete
    const existing = await db.inv.findOne({ _id: id });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    await db.inv.remove({ _id: id }, { multi: false });
    await db.items.remove({ invoiceId: id }, { multi: true });
    res.json({ success: true });
  } catch(e) {
    console.error('DELETE error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Stats
app.get('/api/stats', async (req, res) => {
  try {
    const all = await db.inv.find({});
    let total_revenue = 0;
    for (const inv of all) {
      const its = await db.items.find({ invoiceId: inv._id });
      total_revenue += its.reduce((s, it) => s + (it.qty||0)*(it.rate||0), 0);
    }
    res.json({
      total_invoices: all.length,
      total_revenue,
      pending: all.filter(i => i.status === 'pending').length,
      paid:    all.filter(i => i.status === 'paid').length,
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

app.listen(PORT, () => console.log(`✅  H&CO Invoices → http://localhost:${PORT}`));
