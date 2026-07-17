/**
 * api.js — Central API client for Focused Tab Enforcer
 *
 * ALL backend communication goes through this file.
 * Uses the native fetch API — no extra dependencies needed.
 *
 * Features:
 *  - Automatic Authorization header injection from localStorage
 *  - Automatic token refresh on 401 (single-flight)
 *  - Consistent error shape: throws { message, status, data }
 *  - Multipart (FormData) support for file uploads
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ─── Token storage helpers ────────────────────────────────────────────────────

export const tokens = {
  getAccess:  () => localStorage.getItem('fte_access_token'),
  getRefresh: () => localStorage.getItem('fte_refresh_token'),
  setAccess:  (t) => localStorage.setItem('fte_access_token', t),
  setRefresh: (t) => localStorage.setItem('fte_refresh_token', t),
  clear:      () => {
    localStorage.removeItem('fte_access_token');
    localStorage.removeItem('fte_refresh_token');
    localStorage.removeItem('fte_user');
  },
};

// ─── User persistence ─────────────────────────────────────────────────────────

export const persistedUser = {
  get: () => {
    try { return JSON.parse(localStorage.getItem('fte_user')); } catch { return null; }
  },
  set: (u) => localStorage.setItem('fte_user', JSON.stringify(u)),
  clear: () => localStorage.removeItem('fte_user'),
};

// ─── Refresh token logic (single-flight lock) ─────────────────────────────────

let _refreshPromise = null;

async function _refreshAccessToken() {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    const refreshToken = tokens.getRefresh();
    if (!refreshToken) throw new Error('No refresh token');

    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      tokens.clear();
      // Force navigation to login — clear any persisted user data
      try { localStorage.removeItem('fte_user'); } catch {}
      window.location.replace('/login');
      throw new Error('Session expired. Please log in again.');
    }

    const json = await res.json();
    tokens.setAccess(json.data.accessToken);
    if (json.data.refreshToken) tokens.setRefresh(json.data.refreshToken);
    return json.data.accessToken;
  })();

  try {
    return await _refreshPromise;
  } finally {
    _refreshPromise = null;
  }
}

// ─── Core request function ────────────────────────────────────────────────────

/**
 * @param {string} method  HTTP method
 * @param {string} path    Path relative to BASE_URL (e.g. '/auth/login')
 * @param {*}      body    Request body (object or FormData)
 * @param {object} opts    Extra options: { isRetry, headers }
 * @returns {Promise<any>} Parsed response data
 */
async function request(method, path, body = null, opts = {}) {
  const accessToken = tokens.getAccess();

  const headers = { ...opts.headers };

  // Don't set Content-Type for FormData — browser sets it with boundary
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const fetchOpts = {
    method,
    headers,
  };

  if (body) {
    fetchOpts.body = body instanceof FormData ? body : JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, fetchOpts);
  } catch (networkErr) {
    throw { message: 'Cannot reach the server. Check your connection.', status: 0, data: null };
  }

  // Auto-refresh on 401 (only once)
  if (res.status === 401 && !opts.isRetry) {
    try {
      await _refreshAccessToken();
      return request(method, path, body, { ...opts, isRetry: true });
    } catch {
      throw { message: 'Session expired. Please log in again.', status: 401, data: null };
    }
  }

  // Parse response
  let json;
  const contentType = res.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    json = await res.json();
  } else if (
    contentType.includes('text/csv') ||
    contentType.includes('application/octet-stream')
  ) {
    // For file downloads — return the raw response
    return res;
  } else {
    json = { message: await res.text() };
  }

  if (!res.ok) {
    throw {
      message: json?.message || `Request failed with status ${res.status}`,
      status: res.status,
      data: json,
    };
  }

  return json?.data ?? json;
}

// ─── HTTP method shortcuts ────────────────────────────────────────────────────

const api = {
  get:    (path, opts)       => request('GET',    path, null, opts),
  post:   (path, body, opts) => request('POST',   path, body, opts),
  put:    (path, body, opts) => request('PUT',    path, body, opts),
  patch:  (path, body, opts) => request('PATCH',  path, body, opts),
  delete: (path, opts)       => request('DELETE', path, null, opts),
};

export default api;

// =============================================================================
// ─── Grouped API modules ─────────────────────────────────────────────────────
// =============================================================================

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  /**
   * Register a new institution.
   * @param {{ name, email, password, address?, contactPhone?, website? }} data
   */
  registerInstitution: (data) =>
    api.post('/auth/institution/register', data),

  /**
   * Institution login — returns { institution, accessToken } + sets refresh cookie.
   */
  loginInstitution: (email, password) =>
    api.post('/auth/institution/login', { email, password }),

  /**
   * Admin user login.
   */
  loginAdmin: (email, password, institutionId) =>
    api.post('/auth/admin/login', { email, password, institutionId }),

  /** Refresh access token using stored refresh token. */
  refresh: () => _refreshAccessToken(),

  /** Logout — invalidates refresh token server-side. */
  logout: (refreshToken) =>
    api.post('/auth/logout', { refreshToken }),

  /** Send password reset email. */
  forgotPassword: (email, userType = 'institution') =>
    api.post('/auth/forgot-password', { email, userType }),

  /** Reset password with the emailed token. */
  resetPassword: (token, newPassword, userType = 'institution') =>
    api.post('/auth/reset-password', { token, newPassword, userType }),
};

// ─── Institution ──────────────────────────────────────────────────────────────
export const institutionApi = {
  /** Get the current institution's profile. */
  getProfile: () =>
    api.get('/institution/profile'),

  /** Update profile fields (name, address, contactPhone, website, logoUrl). */
  updateProfile: (data) =>
    api.put('/institution/profile', data),

  /** Dashboard stats: exams, sessions, violations today, students. */
  getStats: () =>
    api.get('/institution/stats'),

  /** Get institution settings (monitoring defaults, notifications, retention). */
  getSettings: () =>
    api.get('/institution/settings'),

  /** Update institution settings. */
  updateSettings: (data) =>
    api.put('/institution/settings', data),

  /** Get hourly violation/session trend for a specific date (default: today). */
  getTrend: (date) =>
    api.get(`/institution/trend${date ? `?date=${date}` : ''}`),
};

// ─── Exams ────────────────────────────────────────────────────────────────────
export const examsApi = {
  /**
   * List exams with optional filters.
   * @param {{ page?, limit?, status?, startDate?, endDate? }} params
   */
  list: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
    ).toString();
    return api.get(`/exams${qs ? `?${qs}` : ''}`);
  },

  /** Get a single exam with enrollment count. */
  get: (id) =>
    api.get(`/exams/${id}`),

  /**
   * Create a new exam.
   * @param {{ title, scheduledDate, durationMinutes, description?, allowedDomains?, violationThresholds? }} data
   */
  create: (data) =>
    api.post('/exams', data),

  /** Update an exam (only allowed when status is draft or scheduled). */
  update: (id, data) =>
    api.put(`/exams/${id}`, data),

  /** Soft-delete an exam. */
  delete: (id) =>
    api.delete(`/exams/${id}`),

  /** Bulk enroll students by their IDs. */
  enrollStudents: (examId, studentIds) =>
    api.post(`/exams/${examId}/enroll`, { studentIds }),

  /** List enrolled students with verification status. */
  getStudents: (examId) =>
    api.get(`/exams/${examId}/students`),

  /** Activate exam (status → active). */
  start: (id) =>
    api.post(`/exams/${id}/start`),

  /** End exam (status → completed). */
  end: (id) =>
    api.post(`/exams/${id}/end`),
};

// ─── Students ─────────────────────────────────────────────────────────────────
export const studentsApi = {
  /**
   * List students with optional search and pagination.
   * @param {{ search?, page?, limit? }} params
   */
  list: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
    ).toString();
    return api.get(`/students${qs ? `?${qs}` : ''}`);
  },

  /** Get a single student with exam history. */
  get: (id) =>
    api.get(`/students/${id}`),

  /** Add a single student. */
  create: (data) =>
    api.post('/students', data),

  /**
   * Bulk import students from a CSV File object.
   * @param {File} file
   */
  bulkImport: (file) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/students/bulk', form);
  },

  /** Update a student's details. */
  update: (id, data) =>
    api.put(`/students/${id}`, data),

  /** Permanently delete a student and all their exam data. */
  delete: (id) =>
    api.delete(`/students/${id}`),
};

// ─── Monitoring / Sessions ────────────────────────────────────────────────────
export const monitoringApi = {
  /** Get all currently active monitoring sessions for this institution. */
  getLiveSessions: () =>
    api.get('/sessions/live'),

  /** Get a full session report with violations timeline. */
  getSessionReport: (sessionId) =>
    api.get(`/sessions/${sessionId}/report`),

  /** Get chronological violation timeline for a session. */
  getTimeline: (sessionId) =>
    api.get(`/sessions/${sessionId}/timeline`),
};

// ─── Reports ──────────────────────────────────────────────────────────────────
export const reportsApi = {
  /** Exam summary: enrollment, violation breakdown, averages. */
  getExamSummary: (examId) =>
    api.get(`/reports/exams/${examId}/summary`),

  /**
   * Exam violations list with optional filters.
   * @param {string} examId
   * @param {{ eventType?, severity?, studentId?, page?, limit? }} params
   */
  getExamViolations: (examId, params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
    ).toString();
    return api.get(`/reports/exams/${examId}/violations${qs ? `?${qs}` : ''}`);
  },

  /** Student complete monitoring history across all exams. */
  getStudentHistory: (studentId) =>
    api.get(`/reports/students/${studentId}/history`),

  /**
   * Download exam export — returns a raw fetch Response for blob handling.
   * @param {string} examId
   * @param {'json'|'csv'} format
   */
  exportExam: (examId, format = 'json') =>
    api.get(`/reports/export/${examId}?format=${format}`),
};
