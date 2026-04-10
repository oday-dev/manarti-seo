/**
 * routes/transactions.js - Journal entries and financial transactions API
 * مسارات القيود اليومية والمعاملات المالية
 */

const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/journal-entries - Get all journal entries
router.get('/', (req, res) => {
  const { from, to, search } = req.query;
  let entries = db.getAll('journal_entries');

  if (from) entries = entries.filter(e => e.date >= from);
  if (to) entries = entries.filter(e => e.date <= to);
  if (search) {
    const q = search.toLowerCase();
    entries = entries.filter(e =>
      e.description.toLowerCase().includes(q) ||
      e.reference.toLowerCase().includes(q)
    );
  }

  entries = entries.sort((a, b) => b.date.localeCompare(a.date));

  // Attach lines to each entry
  const lines = db.getAll('journal_entry_lines');
  const accounts = db.getAll('accounts');

  const result = entries.map(entry => {
    const entryLines = lines
      .filter(l => l.entry_id === entry.id)
      .map(l => {
        const account = accounts.find(a => a.id === l.account_id);
        return { ...l, account_name_ar: account ? account.name_ar : '', account_code: account ? account.code : '' };
      });
    const totalDebit = entryLines.reduce((s, l) => s + (l.debit || 0), 0);
    const totalCredit = entryLines.reduce((s, l) => s + (l.credit || 0), 0);
    return { ...entry, lines: entryLines, total_debit: totalDebit, total_credit: totalCredit };
  });

  res.json({ success: true, data: result });
});

// GET /api/journal-entries/:id - Get single journal entry
router.get('/:id', (req, res) => {
  const entry = db.getById('journal_entries', req.params.id);
  if (!entry) return res.status(404).json({ success: false, message: 'القيد غير موجود' });

  const lines = db.query('journal_entry_lines', l => l.entry_id === entry.id);
  const accounts = db.getAll('accounts');

  const enrichedLines = lines.map(l => {
    const account = accounts.find(a => a.id === l.account_id);
    return { ...l, account_name_ar: account ? account.name_ar : '', account_code: account ? account.code : '' };
  });

  res.json({ success: true, data: { ...entry, lines: enrichedLines } });
});

// POST /api/journal-entries - Create journal entry (with lines)
router.post('/', (req, res) => {
  const { date, reference, description, lines } = req.body;

  if (!date || !description) {
    return res.status(400).json({
      success: false,
      message: 'الحقول المطلوبة: التاريخ، الوصف'
    });
  }

  if (!lines || !Array.isArray(lines) || lines.length < 2) {
    return res.status(400).json({
      success: false,
      message: 'يجب أن يحتوي القيد على سطرين على الأقل'
    });
  }

  // Validate double-entry: total debits must equal total credits
  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    return res.status(400).json({
      success: false,
      message: `القيد غير متوازن: مجموع المدين (${totalDebit.toFixed(2)}) لا يساوي مجموع الدائن (${totalCredit.toFixed(2)})`
    });
  }

  if (totalDebit === 0) {
    return res.status(400).json({ success: false, message: 'يجب أن تكون قيمة القيد أكبر من صفر' });
  }

  // Validate all accounts exist
  const accounts = db.getAll('accounts');
  for (const line of lines) {
    if (!line.account_id) {
      return res.status(400).json({ success: false, message: 'يجب تحديد الحساب لكل سطر' });
    }
    const account = accounts.find(a => a.id === Number(line.account_id));
    if (!account) {
      return res.status(400).json({ success: false, message: `الحساب رقم ${line.account_id} غير موجود` });
    }
    if (account.is_parent) {
      return res.status(400).json({ success: false, message: `لا يمكن الترحيل لحساب رئيسي: ${account.name_ar}` });
    }
  }

  // Create the entry
  const entry = db.insert('journal_entries', {
    date,
    reference: reference || `JE-${Date.now()}`,
    description,
    total_debit: totalDebit,
    total_credit: totalCredit,
    created_at: new Date().toISOString()
  });

  // Create entry lines
  const createdLines = lines.map(line => {
    return db.insert('journal_entry_lines', {
      entry_id: entry.id,
      account_id: Number(line.account_id),
      party_id: line.party_id ? Number(line.party_id) : null,
      debit: Number(line.debit) || 0,
      credit: Number(line.credit) || 0,
      description: line.description || ''
    });
  });

  res.status(201).json({
    success: true,
    data: { ...entry, lines: createdLines },
    message: 'تم إنشاء القيد بنجاح'
  });
});

// DELETE /api/journal-entries/:id - Delete journal entry
router.delete('/:id', (req, res) => {
  const entry = db.getById('journal_entries', req.params.id);
  if (!entry) return res.status(404).json({ success: false, message: 'القيد غير موجود' });

  // Delete all lines first
  const lines = db.query('journal_entry_lines', l => l.entry_id === entry.id);
  lines.forEach(l => db.delete('journal_entry_lines', l.id));

  // Delete the entry
  db.delete('journal_entries', req.params.id);

  res.json({ success: true, message: 'تم حذف القيد بنجاح' });
});

// GET /api/journal-entries/stats/summary - Get summary statistics
router.get('/stats/summary', (req, res) => {
  const entries = db.getAll('journal_entries');
  const lines = db.getAll('journal_entry_lines');

  const totalDebits = lines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredits = lines.reduce((s, l) => s + (l.credit || 0), 0);

  res.json({
    success: true,
    data: {
      total_entries: entries.length,
      total_debits: totalDebits,
      total_credits: totalCredits
    }
  });
});

module.exports = router;
