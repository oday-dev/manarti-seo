/**
 * database.js - File-based JSON database for the accounting system
 * قاعدة البيانات المحلية للنظام المحاسبي
 */

const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data', 'accounting.json');

// Default database structure
const DEFAULT_DB = {
  accounts: [],
  parties: [],
  journal_entries: [],
  journal_entry_lines: [],
  settings: {
    company_name_ar: 'شركة منارتي',
    company_name_en: 'Manarti Company',
    currency: 'USD',
    currency_ar: 'دولار أمريكي',
    fiscal_year_start: '2024-01-01',
    language: 'ar'
  },
  _sequences: {
    accounts: 0,
    parties: 0,
    journal_entries: 0,
    journal_entry_lines: 0
  }
};

// Default chart of accounts (شجرة الحسابات الافتراضية)
const DEFAULT_ACCOUNTS = [
  // Assets - الأصول
  { id: 1, code: '1', name_ar: 'الأصول', name_en: 'Assets', type: 'asset', balance_type: 'debit', parent_id: null, is_parent: true },
  { id: 2, code: '11', name_ar: 'الأصول المتداولة', name_en: 'Current Assets', type: 'asset', balance_type: 'debit', parent_id: 1, is_parent: true },
  { id: 3, code: '111', name_ar: 'النقدية وما يعادلها', name_en: 'Cash and Equivalents', type: 'asset', balance_type: 'debit', parent_id: 2, is_parent: false },
  { id: 4, code: '112', name_ar: 'البنك', name_en: 'Bank', type: 'asset', balance_type: 'debit', parent_id: 2, is_parent: false },
  { id: 5, code: '113', name_ar: 'حسابات العملاء', name_en: 'Accounts Receivable', type: 'asset', balance_type: 'debit', parent_id: 2, is_parent: false },
  { id: 6, code: '114', name_ar: 'المخزون', name_en: 'Inventory', type: 'asset', balance_type: 'debit', parent_id: 2, is_parent: false },
  { id: 7, code: '12', name_ar: 'الأصول الثابتة', name_en: 'Fixed Assets', type: 'asset', balance_type: 'debit', parent_id: 1, is_parent: true },
  { id: 8, code: '121', name_ar: 'الأثاث والمعدات', name_en: 'Furniture & Equipment', type: 'asset', balance_type: 'debit', parent_id: 7, is_parent: false },
  { id: 9, code: '122', name_ar: 'السيارات', name_en: 'Vehicles', type: 'asset', balance_type: 'debit', parent_id: 7, is_parent: false },
  // Liabilities - الخصوم
  { id: 10, code: '2', name_ar: 'الخصوم', name_en: 'Liabilities', type: 'liability', balance_type: 'credit', parent_id: null, is_parent: true },
  { id: 11, code: '21', name_ar: 'الخصوم المتداولة', name_en: 'Current Liabilities', type: 'liability', balance_type: 'credit', parent_id: 10, is_parent: true },
  { id: 12, code: '211', name_ar: 'حسابات الموردين', name_en: 'Accounts Payable', type: 'liability', balance_type: 'credit', parent_id: 11, is_parent: false },
  { id: 13, code: '212', name_ar: 'القروض قصيرة الأجل', name_en: 'Short-term Loans', type: 'liability', balance_type: 'credit', parent_id: 11, is_parent: false },
  { id: 14, code: '22', name_ar: 'الخصوم طويلة الأجل', name_en: 'Long-term Liabilities', type: 'liability', balance_type: 'credit', parent_id: 10, is_parent: true },
  { id: 15, code: '221', name_ar: 'القروض طويلة الأجل', name_en: 'Long-term Loans', type: 'liability', balance_type: 'credit', parent_id: 14, is_parent: false },
  // Equity - حقوق الملكية
  { id: 16, code: '3', name_ar: 'حقوق الملكية', name_en: 'Equity', type: 'equity', balance_type: 'credit', parent_id: null, is_parent: true },
  { id: 17, code: '31', name_ar: 'رأس المال', name_en: 'Capital', type: 'equity', balance_type: 'credit', parent_id: 16, is_parent: false },
  { id: 18, code: '32', name_ar: 'الأرباح المحتجزة', name_en: 'Retained Earnings', type: 'equity', balance_type: 'credit', parent_id: 16, is_parent: false },
  // Revenue - الإيرادات
  { id: 19, code: '4', name_ar: 'الإيرادات', name_en: 'Revenue', type: 'revenue', balance_type: 'credit', parent_id: null, is_parent: true },
  { id: 20, code: '41', name_ar: 'إيرادات المبيعات', name_en: 'Sales Revenue', type: 'revenue', balance_type: 'credit', parent_id: 19, is_parent: false },
  { id: 21, code: '42', name_ar: 'إيرادات الخدمات', name_en: 'Service Revenue', type: 'revenue', balance_type: 'credit', parent_id: 19, is_parent: false },
  { id: 22, code: '43', name_ar: 'إيرادات أخرى', name_en: 'Other Revenue', type: 'revenue', balance_type: 'credit', parent_id: 19, is_parent: false },
  // Expenses - المصروفات
  { id: 23, code: '5', name_ar: 'المصروفات', name_en: 'Expenses', type: 'expense', balance_type: 'debit', parent_id: null, is_parent: true },
  { id: 24, code: '51', name_ar: 'تكلفة البضاعة المباعة', name_en: 'Cost of Goods Sold', type: 'expense', balance_type: 'debit', parent_id: 23, is_parent: false },
  { id: 25, code: '52', name_ar: 'مصروفات الرواتب', name_en: 'Salary Expenses', type: 'expense', balance_type: 'debit', parent_id: 23, is_parent: false },
  { id: 26, code: '53', name_ar: 'مصروفات الإيجار', name_en: 'Rent Expenses', type: 'expense', balance_type: 'debit', parent_id: 23, is_parent: false },
  { id: 27, code: '54', name_ar: 'مصروفات المرافق', name_en: 'Utility Expenses', type: 'expense', balance_type: 'debit', parent_id: 23, is_parent: false },
  { id: 28, code: '55', name_ar: 'مصروفات أخرى', name_en: 'Other Expenses', type: 'expense', balance_type: 'debit', parent_id: 23, is_parent: false }
];

class Database {
  constructor() {
    this._ensureDataDir();
    this._db = this._load();
  }

  _ensureDataDir() {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  _load() {
    if (!fs.existsSync(DB_FILE)) {
      const db = { ...DEFAULT_DB };
      db.accounts = DEFAULT_ACCOUNTS.map(a => ({ ...a }));
      db._sequences.accounts = DEFAULT_ACCOUNTS.length;
      this._save(db);
      return db;
    }
    try {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch {
      const db = { ...DEFAULT_DB };
      db.accounts = DEFAULT_ACCOUNTS.map(a => ({ ...a }));
      db._sequences.accounts = DEFAULT_ACCOUNTS.length;
      return db;
    }
  }

  _save(db) {
    const dbToSave = db || this._db;
    fs.writeFileSync(DB_FILE, JSON.stringify(dbToSave, null, 2), 'utf8');
  }

  nextId(table) {
    this._db._sequences[table] = (this._db._sequences[table] || 0) + 1;
    return this._db._sequences[table];
  }

  // Generic CRUD operations
  getAll(table) {
    return this._db[table] || [];
  }

  getById(table, id) {
    return (this._db[table] || []).find(r => r.id === Number(id)) || null;
  }

  insert(table, record) {
    if (!this._db[table]) this._db[table] = [];
    const newRecord = { ...record, id: this.nextId(table) };
    this._db[table].push(newRecord);
    this._save();
    return newRecord;
  }

  update(table, id, updates) {
    const idx = (this._db[table] || []).findIndex(r => r.id === Number(id));
    if (idx === -1) return null;
    this._db[table][idx] = { ...this._db[table][idx], ...updates, id: Number(id) };
    this._save();
    return this._db[table][idx];
  }

  delete(table, id) {
    const before = (this._db[table] || []).length;
    this._db[table] = (this._db[table] || []).filter(r => r.id !== Number(id));
    const deleted = this._db[table].length < before;
    if (deleted) this._save();
    return deleted;
  }

  query(table, predicate) {
    return (this._db[table] || []).filter(predicate);
  }

  getSettings() {
    return this._db.settings;
  }

  updateSettings(updates) {
    this._db.settings = { ...this._db.settings, ...updates };
    this._save();
    return this._db.settings;
  }
}

module.exports = new Database();
