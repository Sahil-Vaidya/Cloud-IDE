/**
 * API Client
 * Centralized HTTP client for communicating with the FastAPI backend.
 */

const API_BASE = 'http://localhost:8000';
const WS_BASE = 'ws://localhost:8000';

/**
 * Generic fetch wrapper with error handling.
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  };

  const response = await fetch(url, config);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

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
  delete: (name) => request(`/api/projects/${name}`, { method: 'DELETE' }),
  selectLocal: () => request('/api/projects/select-local', { method: 'POST' }),
};

// ─── File APIs ──────────────────────────────────────────────────

export const fileAPI = {
  getTree: (project) => request(`/api/files/${project}`),
  readFile: (project, path) =>
    request(`/api/files/${project}/content?path=${encodeURIComponent(path)}`),
  writeFile: (project, path, content) =>
    request(`/api/files/${project}/content`, {
      method: 'PUT',
      body: JSON.stringify({ path, content }),
    }),
  createItem: (project, path, type = 'file') =>
    request(`/api/files/${project}/create`, {
      method: 'POST',
      body: JSON.stringify({ path, type }),
    }),
  deleteItem: (project, path) =>
    request(`/api/files/${project}/content?path=${encodeURIComponent(path)}`, {
      method: 'DELETE',
    }),
  renameItem: (project, oldPath, newPath) =>
    request(`/api/files/${project}/rename`, {
      method: 'POST',
      body: JSON.stringify({ old_path: oldPath, new_path: newPath }),
    }),
};

// ─── Process APIs ───────────────────────────────────────────────

export const processAPI = {
  start: (project, command = null, port = 8080) =>
    request('/api/process/start', {
      method: 'POST',
      body: JSON.stringify({ project, command, port }),
    }),
  stop: (project) =>
    request(`/api/process/stop?project=${encodeURIComponent(project)}`, {
      method: 'POST',
    }),
  restart: (project) =>
    request(`/api/process/restart?project=${encodeURIComponent(project)}`, {
      method: 'POST',
    }),
  status: (project) => request(`/api/process/status/${project}`),
  detect: (project) => request(`/api/process/detect/${project}`),
  getLogs: (project, count = 100) =>
    request(`/api/process/logs/${project}?count=${count}`),
};

// ─── Database APIs ──────────────────────────────────────────────

export const databaseAPI = {
  listDatabases: (project) => request(`/api/db/${project}/databases`),
  listTables: (project, dbPath) =>
    request(`/api/db/${project}/tables?db_path=${encodeURIComponent(dbPath)}`),
  getSchema: (project, table, dbPath) =>
    request(`/api/db/${project}/schema/${table}?db_path=${encodeURIComponent(dbPath)}`),
  getRows: (project, table, dbPath, page = 1, pageSize = 50) =>
    request(
      `/api/db/${project}/rows/${table}?db_path=${encodeURIComponent(dbPath)}&page=${page}&page_size=${pageSize}`
    ),
  executeQuery: (project, dbPath, query) =>
    request(`/api/db/${project}/query`, {
      method: 'POST',
      body: JSON.stringify({ db_path: dbPath, query }),
    }),
};

// ─── WebSocket Helpers ──────────────────────────────────────────

export function createTerminalWS(project) {
  return new WebSocket(`${WS_BASE}/ws/terminal/${project}`);
}

export function createLogsWS(project) {
  return new WebSocket(`${WS_BASE}/ws/logs/${project}`);
}

export default { projectAPI, fileAPI, processAPI, databaseAPI };
