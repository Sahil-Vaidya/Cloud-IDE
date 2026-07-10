/**
 * API Client
 * Centralized HTTP client for communicating with the FastAPI backend.
 */

const API_BASE = 'http://localhost:8000';
const WS_BASE = 'ws://localhost:8000';

/**
 * Encodes a project name/path in hex if it contains absolute path characters (:, \, /).
 * This prevents web servers from blocking the request due to path validation rules.
 */
function encodeProject(project) {
  if (!project) return '';
  const needsEncoding = project.includes(':') || project.includes('\\') || project.includes('/');
  if (!needsEncoding) {
    return project;
  }
  const hex = Array.from(project).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
  return `hex_${hex}`;
}

/**
 * Generic fetch wrapper with error handling and automatic Auth header.
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;

  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = localStorage.getItem('cloud_ide_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = { headers, ...options };
  const response = await fetch(url, config);

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('cloud_ide_token');
      localStorage.removeItem('cloud_ide_user');
      if (!endpoint.includes('/api/auth/')) {
        window.location.reload();
      }
    }
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

// ─── Auth APIs ──────────────────────────────────────────────────
export const authAPI = {
  register: (email, password) =>
    request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  login: (email, password) =>
    request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
};

// ─── Project APIs ───────────────────────────────────────────────
export const projectAPI = {
  list: () => request('/api/projects'),
  create: (name, template = 'blank') =>
    request('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name, template }),
    }),
  clone: (name, url) =>
    request('/api/projects/clone', {
      method: 'POST',
      body: JSON.stringify({ name, url }),
    }),
  delete: (name) => request(`/api/projects/${encodeURIComponent(encodeProject(name))}`, { method: 'DELETE' }),
  selectLocal: () => request('/api/projects/select-local', { method: 'POST' }),
  upload: (formData) => {
    const token = localStorage.getItem('cloud_ide_token');
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch(`${API_BASE}/api/projects/upload`, {
      method: 'POST',
      headers,
      body: formData,
    }).then(async (response) => {
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(error.detail || `HTTP ${response.status}`);
      }
      return response.json();
    });
  },
};

// ─── File APIs ──────────────────────────────────────────────────
export const fileAPI = {
  getTree: (project) => request(`/api/files/${encodeURIComponent(encodeProject(project))}`),
  readFile: (project, path) =>
    request(`/api/files/${encodeURIComponent(encodeProject(project))}/content?path=${encodeURIComponent(path)}`),
  writeFile: (project, path, content) =>
    request(`/api/files/${encodeURIComponent(encodeProject(project))}/content`, {
      method: 'PUT',
      body: JSON.stringify({ path, content }),
    }),
  createItem: (project, path, type = 'file') =>
    request(`/api/files/${encodeURIComponent(encodeProject(project))}/create`, {
      method: 'POST',
      body: JSON.stringify({ path, type }),
    }),
  deleteItem: (project, path) =>
    request(`/api/files/${encodeURIComponent(encodeProject(project))}/content?path=${encodeURIComponent(path)}`, {
      method: 'DELETE',
    }),
  renameItem: (project, oldPath, newPath) =>
    request(`/api/files/${encodeURIComponent(encodeProject(project))}/rename`, {
      method: 'POST',
      body: JSON.stringify({ old_path: oldPath, new_path: newPath }),
    }),
};

// ─── Process APIs ───────────────────────────────────────────────
export const processAPI = {
  start: (project, command = null, port = 8080) =>
    request('/api/process/start', {
      method: 'POST',
      body: JSON.stringify({ project: encodeProject(project), command, port }),
    }),
  stop: (project) =>
    request(`/api/process/stop?project=${encodeURIComponent(encodeProject(project))}`, { method: 'POST' }),
  restart: (project) =>
    request(`/api/process/restart?project=${encodeURIComponent(encodeProject(project))}`, { method: 'POST' }),
  status: (project) => request(`/api/process/status/${encodeURIComponent(encodeProject(project))}`),
  detect: (project) => request(`/api/process/detect/${encodeURIComponent(encodeProject(project))}`),
  getLogs: (project, count = 100) => request(`/api/process/logs/${encodeURIComponent(encodeProject(project))}?count=${count}`),
};

// ─── Database APIs ──────────────────────────────────────────────
export const databaseAPI = {
  listDatabases: (project) => request(`/api/db/${encodeURIComponent(encodeProject(project))}/databases`),
  listTables: (project, dbPath) =>
    request(`/api/db/${encodeURIComponent(encodeProject(project))}/tables?db_path=${encodeURIComponent(dbPath)}`),
  getSchema: (project, table, dbPath) =>
    request(`/api/db/${encodeURIComponent(encodeProject(project))}/schema/${table}?db_path=${encodeURIComponent(dbPath)}`),
  getRows: (project, table, dbPath, page = 1, pageSize = 50) =>
    request(
      `/api/db/${encodeURIComponent(encodeProject(project))}/rows/${table}?db_path=${encodeURIComponent(dbPath)}&page=${page}&page_size=${pageSize}`
    ),
  executeQuery: (project, dbPath, query) =>
    request(`/api/db/${encodeURIComponent(encodeProject(project))}/query`, {
      method: 'POST',
      body: JSON.stringify({ db_path: dbPath, query }),
    }),
  getConfig: (project) => request(`/api/db/${encodeURIComponent(encodeProject(project))}/config`),
  saveConfig: (project, config) =>
    request(`/api/db/${encodeURIComponent(encodeProject(project))}/config`, {
      method: 'POST',
      body: JSON.stringify(config),
    }),
  provision: (project, config) =>
    request(`/api/db/${encodeURIComponent(encodeProject(project))}/provision`, {
      method: 'POST',
      body: JSON.stringify(config),
    }),
};


// ─── Search APIs ────────────────────────────────────────────────
export const searchAPI = {
  searchFiles: (project, query, options = {}) => {
    const params = new URLSearchParams({ q: query });
    if (options.caseSensitive) params.set('case_sensitive', 'true');
    if (options.useRegex) params.set('use_regex', 'true');
    if (options.maxResults) params.set('max_results', options.maxResults);
    return request(`/api/search/${encodeURIComponent(encodeProject(project))}?${params}`);
  },
};

// ─── Git APIs ───────────────────────────────────────────────────
export const gitAPI = {
  status: (project) => request(`/api/git/${encodeURIComponent(encodeProject(project))}/status`),
  diff: (project, filepath = null, staged = false) => {
    const params = new URLSearchParams();
    if (filepath) params.set('filepath', filepath);
    if (staged) params.set('staged', 'true');
    return request(`/api/git/${encodeURIComponent(encodeProject(project))}/diff?${params}`);
  },
  log: (project, count = 20) => request(`/api/git/${encodeURIComponent(encodeProject(project))}/log?count=${count}`),
  stage: (project, files) =>
    request(`/api/git/${encodeURIComponent(encodeProject(project))}/stage`, {
      method: 'POST',
      body: JSON.stringify({ files }),
    }),
  unstage: (project, files) =>
    request(`/api/git/${encodeURIComponent(encodeProject(project))}/unstage`, {
      method: 'POST',
      body: JSON.stringify({ files }),
    }),
  commit: (project, message) =>
    request(`/api/git/${encodeURIComponent(encodeProject(project))}/commit`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
  push: (project, remote = 'origin', branch = 'main') =>
    request(`/api/git/${encodeURIComponent(encodeProject(project))}/push`, {
      method: 'POST',
      body: JSON.stringify({ remote, branch }),
    }),
  init: (project) =>
    request(`/api/git/${encodeURIComponent(encodeProject(project))}/init`, { method: 'POST', body: JSON.stringify({}) }),
};

// ─── WebSocket Helpers ──────────────────────────────────────────
export function createTerminalWS(project) {
  const token = localStorage.getItem('cloud_ide_token') || '';
  return new WebSocket(`${WS_BASE}/ws/terminal/${encodeURIComponent(encodeProject(project))}?token=${encodeURIComponent(token)}`);
}

export function createLogsWS(project) {
  const token = localStorage.getItem('cloud_ide_token') || '';
  return new WebSocket(`${WS_BASE}/ws/logs/${encodeURIComponent(encodeProject(project))}?token=${encodeURIComponent(token)}`);
}

export default { authAPI, projectAPI, fileAPI, processAPI, databaseAPI, searchAPI, gitAPI };
