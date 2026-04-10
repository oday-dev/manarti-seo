/**
 * app.js - Shared utilities for Manarti Accounting System
 * الأدوات المشتركة لنظام منارتي المحاسبي
 */

const API_BASE = '/api';

// ===== HTML ESCAPING (XSS Prevention) =====

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// ===== FORMATTING HELPERS =====

function formatCurrency(amount, currency = '') {
  const num = Number(amount) || 0;
  const formatted = num.toLocaleString('ar-SA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return currency ? `${formatted} ${currency}` : formatted;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function today() {
  return new Date().toISOString().split('T')[0];
}

// ===== API HELPERS =====

async function apiGet(url) {
  const res = await fetch(API_BASE + url);
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'خطأ في الطلب');
  return data.data;
}

async function apiPost(url, body) {
  const res = await fetch(API_BASE + url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'خطأ في الطلب');
  return data.data;
}

async function apiPut(url, body) {
  const res = await fetch(API_BASE + url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'خطأ في الطلب');
  return data.data;
}

async function apiDelete(url) {
  const res = await fetch(API_BASE + url, { method: 'DELETE' });
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'خطأ في الطلب');
  return true;
}

// ===== UI HELPERS =====

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMessage');
  if (!toast || !toastMsg) return;
  toastMsg.textContent = message;
  toast.className = `toast align-items-center text-bg-${type} border-0`;
  const bsToast = bootstrap.Toast.getOrCreateInstance(toast, { delay: 3500 });
  bsToast.show();
}

function showError(message) {
  showToast(message, 'danger');
}

function showLoading(tableBody, colSpan = 5) {
  if (tableBody) {
    tableBody.innerHTML = `<tr><td colspan="${colSpan}" class="text-center py-4">
      <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
      <span class="ms-2 text-muted">جاري التحميل...</span>
    </td></tr>`;
  }
}

function showEmpty(tableBody, colSpan = 5, message = 'لا توجد بيانات') {
  if (tableBody) {
    tableBody.innerHTML = `<tr><td colspan="${colSpan}" class="text-center py-4 text-muted">
      <i class="bi bi-inbox fs-3 d-block mb-2"></i>${message}
    </td></tr>`;
  }
}

function confirmDelete(name) {
  return confirm(`هل أنت متأكد من حذف "${name}"؟\nلا يمكن التراجع عن هذا الإجراء.`);
}

// ===== SIDEBAR ACTIVE STATE =====

function setActiveNav(page) {
  document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
    link.classList.remove('active');
    if (link.dataset.page === page) link.classList.add('active');
  });
}

// ===== SIDEBAR TOGGLE =====

document.addEventListener('DOMContentLoaded', () => {
  // Set current date
  const dateEl = document.getElementById('currentDate');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('ar-SA', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  // Sidebar toggle
  const toggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  if (toggle && sidebar) {
    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      document.body.classList.toggle('sidebar-open');
    });
  }

  // Close sidebar on mobile when clicking outside
  document.addEventListener('click', (e) => {
    if (window.innerWidth < 768 && sidebar && sidebar.classList.contains('open')) {
      if (!sidebar.contains(e.target) && !toggle.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    }
  });
});

// ===== ACCOUNT TYPES TRANSLATION =====
const ACCOUNT_TYPES = {
  asset: 'أصول',
  liability: 'خصوم',
  equity: 'حقوق ملكية',
  revenue: 'إيرادات',
  expense: 'مصروفات'
};

const ACCOUNT_TYPE_COLORS = {
  asset: 'success',
  liability: 'danger',
  equity: 'primary',
  revenue: 'info',
  expense: 'warning'
};

function typeLabel(type) {
  return `<span class="badge bg-${ACCOUNT_TYPE_COLORS[type] || 'secondary'}">${ACCOUNT_TYPES[type] || type}</span>`;
}

// Party type translation
const PARTY_TYPES = { customer: 'عميل', supplier: 'مورد' };
function partyTypeLabel(type) {
  return `<span class="badge bg-${type === 'customer' ? 'info' : 'warning'}">${PARTY_TYPES[type] || type}</span>`;
}
