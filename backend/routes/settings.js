/**
 * routes/settings.js - Application settings API
 * مسارات إعدادات التطبيق
 */

const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/settings - Get all settings
router.get('/', (req, res) => {
  res.json({ success: true, data: db.getSettings() });
});

// PUT /api/settings - Update settings
router.put('/', (req, res) => {
  const {
    company_name_ar, company_name_en,
    currency, currency_ar,
    fiscal_year_start, language
  } = req.body;

  const updated = db.updateSettings({
    ...(company_name_ar !== undefined && { company_name_ar }),
    ...(company_name_en !== undefined && { company_name_en }),
    ...(currency !== undefined && { currency }),
    ...(currency_ar !== undefined && { currency_ar }),
    ...(fiscal_year_start !== undefined && { fiscal_year_start }),
    ...(language !== undefined && { language })
  });

  res.json({ success: true, data: updated, message: 'تم حفظ الإعدادات بنجاح' });
});

module.exports = router;
