/**
 * routes/reports.js - Financial reports API
 * مسارات التقارير المالية
 */

const express = require('express');
const router = express.Router();
const db = require('../database');

/**
 * Helper: Calculate account balance from journal entry lines
 */
function getAccountBalance(accountId) {
  const lines = db.query('journal_entry_lines', l => l.account_id === Number(accountId));
  const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);
  return { totalDebit, totalCredit };
}

/**
 * Helper: Get net balance for account (positive = normal balance direction)
 */
function getNetBalance(account) {
  const { totalDebit, totalCredit } = getAccountBalance(account.id);
  if (account.balance_type === 'debit') {
    return totalDebit - totalCredit;
  } else {
    return totalCredit - totalDebit;
  }
}

// GET /api/reports/trial-balance - ميزان المراجعة
router.get('/trial-balance', (req, res) => {
  const { from, to } = req.query;
  const accounts = db.getAll('accounts').filter(a => !a.is_parent);
  let lines = db.getAll('journal_entry_lines');

  if (from || to) {
    const entries = db.getAll('journal_entries');
    const filteredEntryIds = entries
      .filter(e => (!from || e.date >= from) && (!to || e.date <= to))
      .map(e => e.id);
    lines = lines.filter(l => filteredEntryIds.includes(l.entry_id));
  }

  const result = accounts.map(account => {
    const accountLines = lines.filter(l => l.account_id === account.id);
    const totalDebit = accountLines.reduce((s, l) => s + (l.debit || 0), 0);
    const totalCredit = accountLines.reduce((s, l) => s + (l.credit || 0), 0);
    return {
      account_id: account.id,
      code: account.code,
      name_ar: account.name_ar,
      name_en: account.name_en,
      type: account.type,
      balance_type: account.balance_type,
      total_debit: totalDebit,
      total_credit: totalCredit,
      debit_balance: totalDebit > totalCredit ? totalDebit - totalCredit : 0,
      credit_balance: totalCredit > totalDebit ? totalCredit - totalDebit : 0
    };
  }).filter(a => a.total_debit > 0 || a.total_credit > 0);

  const grandTotalDebit = result.reduce((s, a) => s + a.total_debit, 0);
  const grandTotalCredit = result.reduce((s, a) => s + a.total_credit, 0);

  res.json({
    success: true,
    data: {
      accounts: result,
      totals: { total_debit: grandTotalDebit, total_credit: grandTotalCredit },
      is_balanced: Math.abs(grandTotalDebit - grandTotalCredit) < 0.01
    }
  });
});

// GET /api/reports/general-ledger - دفتر الأستاذ العام
router.get('/general-ledger', (req, res) => {
  const { account_id, from, to } = req.query;

  let accounts = db.getAll('accounts').filter(a => !a.is_parent);
  if (account_id) {
    accounts = accounts.filter(a => a.id === Number(account_id));
  }

  const allEntries = db.getAll('journal_entries');
  let allLines = db.getAll('journal_entry_lines');

  if (from || to) {
    const filteredEntryIds = allEntries
      .filter(e => (!from || e.date >= from) && (!to || e.date <= to))
      .map(e => e.id);
    allLines = allLines.filter(l => filteredEntryIds.includes(l.entry_id));
  }

  const ledger = accounts.map(account => {
    const lines = allLines.filter(l => l.account_id === account.id);

    const transactions = lines.map(line => {
      const entry = allEntries.find(e => e.id === line.entry_id);
      return {
        date: entry ? entry.date : '',
        reference: entry ? entry.reference : '',
        description: line.description || (entry ? entry.description : ''),
        debit: line.debit || 0,
        credit: line.credit || 0
      };
    }).sort((a, b) => a.date.localeCompare(b.date));

    let balance = 0;
    const withBalance = transactions.map(t => {
      if (account.balance_type === 'debit') {
        balance += t.debit - t.credit;
      } else {
        balance += t.credit - t.debit;
      }
      return { ...t, balance };
    });

    const totalDebit = transactions.reduce((s, t) => s + t.debit, 0);
    const totalCredit = transactions.reduce((s, t) => s + t.credit, 0);

    return {
      account_id: account.id,
      code: account.code,
      name_ar: account.name_ar,
      name_en: account.name_en,
      type: account.type,
      balance_type: account.balance_type,
      transactions: withBalance,
      total_debit: totalDebit,
      total_credit: totalCredit,
      closing_balance: balance
    };
  }).filter(a => a.transactions.length > 0);

  res.json({ success: true, data: ledger });
});

// GET /api/reports/balance-sheet - الميزانية العمومية
router.get('/balance-sheet', (req, res) => {
  const { as_of } = req.query;
  const allAccounts = db.getAll('accounts');
  let allLines = db.getAll('journal_entry_lines');

  if (as_of) {
    const filteredEntryIds = db.getAll('journal_entries')
      .filter(e => e.date <= as_of)
      .map(e => e.id);
    allLines = allLines.filter(l => filteredEntryIds.includes(l.entry_id));
  }

  const leafAccounts = allAccounts.filter(a => !a.is_parent);

  function buildSection(type) {
    return leafAccounts
      .filter(a => a.type === type)
      .map(account => {
        const accountLines = allLines.filter(l => l.account_id === account.id);
        const totalDebit = accountLines.reduce((s, l) => s + (l.debit || 0), 0);
        const totalCredit = accountLines.reduce((s, l) => s + (l.credit || 0), 0);
        const balance = account.balance_type === 'debit'
          ? totalDebit - totalCredit
          : totalCredit - totalDebit;
        return { ...account, balance, total_debit: totalDebit, total_credit: totalCredit };
      })
      .filter(a => a.balance !== 0);
  }

  const assets = buildSection('asset');
  const liabilities = buildSection('liability');
  const equity = buildSection('equity');

  const totalAssets = assets.reduce((s, a) => s + a.balance, 0);
  const totalLiabilities = liabilities.reduce((s, a) => s + a.balance, 0);
  const totalEquity = equity.reduce((s, a) => s + a.balance, 0);

  // Net income from revenue/expenses
  const revenues = buildSection('revenue');
  const expenses = buildSection('expense');
  const netIncome = revenues.reduce((s, a) => s + a.balance, 0) -
    expenses.reduce((s, a) => s + a.balance, 0);

  res.json({
    success: true,
    data: {
      as_of: as_of || new Date().toISOString().split('T')[0],
      assets,
      liabilities,
      equity,
      totals: {
        total_assets: totalAssets,
        total_liabilities: totalLiabilities,
        total_equity: totalEquity + netIncome,
        net_income: netIncome,
        is_balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity + netIncome)) < 0.01
      }
    }
  });
});

// GET /api/reports/income-statement - قائمة الدخل
router.get('/income-statement', (req, res) => {
  const { from, to } = req.query;
  const allAccounts = db.getAll('accounts');
  let allLines = db.getAll('journal_entry_lines');

  if (from || to) {
    const filteredEntryIds = db.getAll('journal_entries')
      .filter(e => (!from || e.date >= from) && (!to || e.date <= to))
      .map(e => e.id);
    allLines = allLines.filter(l => filteredEntryIds.includes(l.entry_id));
  }

  const leafAccounts = allAccounts.filter(a => !a.is_parent);

  function buildSection(type) {
    return leafAccounts
      .filter(a => a.type === type)
      .map(account => {
        const accountLines = allLines.filter(l => l.account_id === account.id);
        const totalDebit = accountLines.reduce((s, l) => s + (l.debit || 0), 0);
        const totalCredit = accountLines.reduce((s, l) => s + (l.credit || 0), 0);
        const balance = account.balance_type === 'debit'
          ? totalDebit - totalCredit
          : totalCredit - totalDebit;
        return { ...account, balance };
      })
      .filter(a => a.balance !== 0);
  }

  const revenues = buildSection('revenue');
  const expenses = buildSection('expense');

  const totalRevenue = revenues.reduce((s, a) => s + a.balance, 0);
  const totalExpenses = expenses.reduce((s, a) => s + a.balance, 0);
  const netIncome = totalRevenue - totalExpenses;

  res.json({
    success: true,
    data: {
      period: { from: from || '', to: to || '' },
      revenues,
      expenses,
      totals: {
        total_revenue: totalRevenue,
        total_expenses: totalExpenses,
        net_income: netIncome,
        is_profit: netIncome >= 0
      }
    }
  });
});

// GET /api/reports/account-statement/:accountId - كشف حساب
router.get('/account-statement/:accountId', (req, res) => {
  const account = db.getById('accounts', req.params.accountId);
  if (!account) return res.status(404).json({ success: false, message: 'الحساب غير موجود' });

  const { from, to } = req.query;
  let lines = db.query('journal_entry_lines', l => l.account_id === account.id);
  const allEntries = db.getAll('journal_entries');

  let transactions = lines.map(line => {
    const entry = allEntries.find(e => e.id === line.entry_id);
    return {
      date: entry ? entry.date : '',
      reference: entry ? entry.reference : '',
      description: line.description || (entry ? entry.description : ''),
      debit: line.debit || 0,
      credit: line.credit || 0
    };
  });

  if (from) transactions = transactions.filter(t => t.date >= from);
  if (to) transactions = transactions.filter(t => t.date <= to);

  transactions.sort((a, b) => a.date.localeCompare(b.date));

  let balance = 0;
  const withBalance = transactions.map(t => {
    if (account.balance_type === 'debit') {
      balance += t.debit - t.credit;
    } else {
      balance += t.credit - t.debit;
    }
    return { ...t, balance };
  });

  res.json({
    success: true,
    data: {
      account,
      transactions: withBalance,
      totals: {
        total_debit: transactions.reduce((s, t) => s + t.debit, 0),
        total_credit: transactions.reduce((s, t) => s + t.credit, 0),
        closing_balance: balance
      }
    }
  });
});

// GET /api/reports/dashboard - Dashboard stats
router.get('/dashboard', (req, res) => {
  const accounts = db.getAll('accounts');
  const parties = db.getAll('parties');
  const entries = db.getAll('journal_entries');
  const lines = db.getAll('journal_entry_lines');

  const leafAccounts = accounts.filter(a => !a.is_parent);

  // Cash balance
  const cashAccounts = leafAccounts.filter(a => a.code.startsWith('111') || a.code.startsWith('112'));
  let cashBalance = 0;
  cashAccounts.forEach(acc => {
    const accLines = lines.filter(l => l.account_id === acc.id);
    const d = accLines.reduce((s, l) => s + (l.debit || 0), 0);
    const c = accLines.reduce((s, l) => s + (l.credit || 0), 0);
    cashBalance += (d - c);
  });

  // Revenue vs Expenses
  const revenueAccounts = leafAccounts.filter(a => a.type === 'revenue');
  const expenseAccounts = leafAccounts.filter(a => a.type === 'expense');

  let totalRevenue = 0;
  revenueAccounts.forEach(acc => {
    const accLines = lines.filter(l => l.account_id === acc.id);
    const c = accLines.reduce((s, l) => s + (l.credit || 0), 0);
    const d = accLines.reduce((s, l) => s + (l.debit || 0), 0);
    totalRevenue += (c - d);
  });

  let totalExpenses = 0;
  expenseAccounts.forEach(acc => {
    const accLines = lines.filter(l => l.account_id === acc.id);
    const d = accLines.reduce((s, l) => s + (l.debit || 0), 0);
    const c = accLines.reduce((s, l) => s + (l.credit || 0), 0);
    totalExpenses += (d - c);
  });

  // Recent entries
  const recentEntries = entries
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  res.json({
    success: true,
    data: {
      total_accounts: leafAccounts.length,
      total_customers: parties.filter(p => p.type === 'customer').length,
      total_suppliers: parties.filter(p => p.type === 'supplier').length,
      total_entries: entries.length,
      cash_balance: cashBalance,
      total_revenue: totalRevenue,
      total_expenses: totalExpenses,
      net_income: totalRevenue - totalExpenses,
      recent_entries: recentEntries
    }
  });
});

module.exports = router;
