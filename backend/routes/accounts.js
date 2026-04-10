/**
 * routes/accounts.js - Chart of accounts API
 * مسارات إدارة شجرة الحسابات
 */

const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/accounts - Get all accounts
router.get('/', (req, res) => {
  const accounts = db.getAll('accounts');
  res.json({ success: true, data: accounts });
});

// GET /api/accounts/:id - Get single account
router.get('/:id', (req, res) => {
  const account = db.getById('accounts', req.params.id);
  if (!account) return res.status(404).json({ success: false, message: 'الحساب غير موجود' });
  res.json({ success: true, data: account });
});

// POST /api/accounts - Create account
router.post('/', (req, res) => {
  const { code, name_ar, name_en, type, balance_type, parent_id, is_parent } = req.body;

  if (!code || !name_ar || !type || !balance_type) {
    return res.status(400).json({
      success: false,
      message: 'الحقول المطلوبة: رقم الحساب، الاسم العربي، النوع، طبيعة الحساب'
    });
  }

  // Check duplicate code
  const existing = db.query('accounts', a => a.code === code);
  if (existing.length > 0) {
    return res.status(400).json({ success: false, message: 'رمز الحساب مستخدم مسبقاً' });
  }

  const account = db.insert('accounts', {
    code,
    name_ar,
    name_en: name_en || name_ar,
    type,
    balance_type,
    parent_id: parent_id ? Number(parent_id) : null,
    is_parent: Boolean(is_parent)
  });

  res.status(201).json({ success: true, data: account, message: 'تم إنشاء الحساب بنجاح' });
});

// PUT /api/accounts/:id - Update account
router.put('/:id', (req, res) => {
  const account = db.getById('accounts', req.params.id);
  if (!account) return res.status(404).json({ success: false, message: 'الحساب غير موجود' });

  const { code, name_ar, name_en, type, balance_type, parent_id, is_parent } = req.body;

  if (code && code !== account.code) {
    const existing = db.query('accounts', a => a.code === code && a.id !== account.id);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'رمز الحساب مستخدم مسبقاً' });
    }
  }

  const updated = db.update('accounts', req.params.id, {
    code: code || account.code,
    name_ar: name_ar || account.name_ar,
    name_en: name_en || account.name_en,
    type: type || account.type,
    balance_type: balance_type || account.balance_type,
    parent_id: parent_id !== undefined ? (parent_id ? Number(parent_id) : null) : account.parent_id,
    is_parent: is_parent !== undefined ? Boolean(is_parent) : account.is_parent
  });

  res.json({ success: true, data: updated, message: 'تم تحديث الحساب بنجاح' });
});

// DELETE /api/accounts/:id - Delete account
router.delete('/:id', (req, res) => {
  // Check if account has children
  const children = db.query('accounts', a => a.parent_id === Number(req.params.id));
  if (children.length > 0) {
    return res.status(400).json({ success: false, message: 'لا يمكن حذف حساب له حسابات فرعية' });
  }

  // Check if account has transactions
  const lines = db.query('journal_entry_lines', l => l.account_id === Number(req.params.id));
  if (lines.length > 0) {
    return res.status(400).json({ success: false, message: 'لا يمكن حذف حساب له معاملات مالية' });
  }

  const deleted = db.delete('accounts', req.params.id);
  if (!deleted) return res.status(404).json({ success: false, message: 'الحساب غير موجود' });

  res.json({ success: true, message: 'تم حذف الحساب بنجاح' });
});

module.exports = router;
