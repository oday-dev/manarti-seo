/**
 * server.js - Main Express server for Manarti Accounting System
 * الخادم الرئيسي لنظام منارتي المحاسبي
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Simple in-memory rate limiter
const rateLimitStore = new Map();
function globalRateLimit(req, res, next) {
  const key = req.ip || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = req.path.startsWith('/api') ? 200 : 600;

  const record = rateLimitStore.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + windowMs;
  }
  record.count += 1;
  rateLimitStore.set(key, record);

  if (record.count > maxRequests) {
    return res.status(429).json({ success: false, message: 'طلبات كثيرة جداً، حاول لاحقاً' });
  }
  next();
}

// Middleware
app.use(cors());
app.use(globalRateLimit);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// API Routes
app.use('/api/accounts', require('./routes/accounts'));
app.use('/api/parties', require('./routes/parties'));
app.use('/api/journal-entries', require('./routes/transactions'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/settings', require('./routes/settings'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Manarti Accounting System is running', version: '1.0.0' });
});

// Catch-all: serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ success: false, message: 'خطأ في الخادم', error: err.message });
});

app.listen(PORT, () => {
  console.log(`✅ Manarti Accounting System running on http://localhost:${PORT}`);
  console.log(`📊 API available at http://localhost:${PORT}/api`);
});

module.exports = app;
