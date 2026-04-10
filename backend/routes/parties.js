/**
 * routes/parties.js - Customers and Suppliers API
 * مسارات إدارة العملاء والموردين
 */

const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/parties - Get all parties (optional filter by type)
router.get('/', (req, res) => {
  const { type } = req.query;
  let parties = db.getAll('parties');
  if (type) {
    parties = parties.filter(p => p.type === type);
  }
  res.json({ success: true, data: parties });
});

// GET /api/parties/:id - Get single party
router.get('/:id', (req, res) => {
  const party = db.getById('parties', req.params.id);
  if (!party) return res.status(404).json({ success: false, message: 'الطرف غير موجود' });
  res.json({ success: true, data: party });
});

// POST /api/parties - Create customer or supplier
router.post('/', (req, res) => {
  const { name, type, phone, email, address, tax_number, initial_balance, balance_type, notes } = req.body;

  if (!name || !type) {
    return res.status(400).json({
      success: false,
      message: 'الحقول المطلوبة: الاسم، النوع (customer/supplier)'
    });
  }

  if (!['customer', 'supplier'].includes(type)) {
    return res.status(400).json({ success: false, message: 'النوع يجب أن يكون customer أو supplier' });
  }

  const party = db.insert('parties', {
    name,
    type,
    phone: phone || '',
    email: email || '',
    address: address || '',
    tax_number: tax_number || '',
    initial_balance: Number(initial_balance) || 0,
    balance_type: balance_type || (type === 'customer' ? 'debit' : 'credit'),
    notes: notes || '',
    created_at: new Date().toISOString()
  });

  res.status(201).json({ success: true, data: party, message: 'تم الإنشاء بنجاح' });
});

// PUT /api/parties/:id - Update party
router.put('/:id', (req, res) => {
  const party = db.getById('parties', req.params.id);
  if (!party) return res.status(404).json({ success: false, message: 'الطرف غير موجود' });

  const { name, type, phone, email, address, tax_number, initial_balance, balance_type, notes } = req.body;

  if (type && !['customer', 'supplier'].includes(type)) {
    return res.status(400).json({ success: false, message: 'النوع يجب أن يكون customer أو supplier' });
  }

  const updated = db.update('parties', req.params.id, {
    name: name !== undefined ? name : party.name,
    type: type || party.type,
    phone: phone !== undefined ? phone : party.phone,
    email: email !== undefined ? email : party.email,
    address: address !== undefined ? address : party.address,
    tax_number: tax_number !== undefined ? tax_number : party.tax_number,
    initial_balance: initial_balance !== undefined ? Number(initial_balance) : party.initial_balance,
    balance_type: balance_type || party.balance_type,
    notes: notes !== undefined ? notes : party.notes
  });

  res.json({ success: true, data: updated, message: 'تم التحديث بنجاح' });
});

// DELETE /api/parties/:id - Delete party
router.delete('/:id', (req, res) => {
  const party = db.getById('parties', req.params.id);
  if (!party) return res.status(404).json({ success: false, message: 'الطرف غير موجود' });

  const deleted = db.delete('parties', req.params.id);
  if (!deleted) return res.status(404).json({ success: false, message: 'الطرف غير موجود' });

  res.json({ success: true, message: 'تم الحذف بنجاح' });
});

// GET /api/parties/:id/statement - Get account statement for a party
router.get('/:id/statement', (req, res) => {
  const party = db.getById('parties', req.params.id);
  if (!party) return res.status(404).json({ success: false, message: 'الطرف غير موجود' });

  const { from, to } = req.query;
  const lines = db.query('journal_entry_lines', l => l.party_id === Number(req.params.id));
  const entries = db.getAll('journal_entries');

  let transactions = lines.map(line => {
    const entry = entries.find(e => e.id === line.entry_id);
    return {
      date: entry ? entry.date : '',
      reference: entry ? entry.reference : '',
      description: line.description || (entry ? entry.description : ''),
      debit: line.debit || 0,
      credit: line.credit || 0,
      entry_id: line.entry_id
    };
  });

  if (from) transactions = transactions.filter(t => t.date >= from);
  if (to) transactions = transactions.filter(t => t.date <= to);

  transactions.sort((a, b) => a.date.localeCompare(b.date));

  let balance = party.initial_balance || 0;
  let runningBalance = balance;

  const withBalance = transactions.map(t => {
    if (party.balance_type === 'debit') {
      runningBalance += t.debit - t.credit;
    } else {
      runningBalance += t.credit - t.debit;
    }
    return { ...t, balance: runningBalance };
  });

  res.json({
    success: true,
    data: {
      party,
      opening_balance: balance,
      transactions: withBalance,
      closing_balance: runningBalance
    }
  });
});

module.exports = router;
