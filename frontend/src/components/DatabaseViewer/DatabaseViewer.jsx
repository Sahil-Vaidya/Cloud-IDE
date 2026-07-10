import React, { useState, useEffect, useCallback } from 'react';
import { VscDatabase, VscTable, VscRefresh, VscSettings } from 'react-icons/vsc';
import { databaseAPI } from '../../utils/api';
import { useToast } from '../common/Toast';
import './DatabaseViewer.css';

export default function DatabaseViewer({ project }) {
  const toast = useToast();
  const [databases, setDatabases] = useState([]);
  const [selectedDb, setSelectedDb] = useState('');
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [schema, setSchema] = useState([]);
  const [rowData, setRowData] = useState(null);
  const [query, setQuery] = useState('');
  const [queryResult, setQueryResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('data'); // 'data' | 'schema' | 'query'
  
  // Database Configuration states
  const [showConfig, setShowConfig] = useState(false);
  const [dbConfig, setDbConfig] = useState({
    type: 'sqlite',
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '',
    database: '',
    mock: false
  });

  // Load databases list
  const loadDatabasesList = useCallback(async () => {
    if (!project) return;
    try {
      const data = await databaseAPI.listDatabases(project);
      setDatabases(data.databases || []);
      if (data.databases?.length > 0) {
        // Only set default if nothing is selected or previous selection is gone
        if (!selectedDb || !data.databases.find(db => db.path === selectedDb)) {
          setSelectedDb(data.databases[0].path);
        }
      } else {
        setSelectedDb('');
      }
    } catch (err) {
      console.error('Failed to load databases:', err);
    }
  }, [project, selectedDb]);

  // Load database list on project load
  useEffect(() => {
    loadDatabasesList();
  }, [project]);

  // Load tables when DB changes
  useEffect(() => {
    if (!project || !selectedDb) {
      setTables([]);
      setSelectedTable('');
      setRowData(null);
      setSchema([]);
      return;
    }
    setError('');
    databaseAPI.listTables(project, selectedDb).then((data) => {
      setTables(data.tables || []);
      setSelectedTable('');
      setRowData(null);
      setSchema([]);
    }).catch((err) => setError(err.message));
  }, [project, selectedDb]);

  // Load db configuration
  useEffect(() => {
    if (!project) return;
    databaseAPI.getConfig(project).then((cfg) => {
      setDbConfig({
        type: cfg.type || 'sqlite',
        host: cfg.host || 'localhost',
        port: cfg.port || 3306,
        user: cfg.user || 'root',
        password: cfg.password || '',
        database: cfg.database || '',
        mock: cfg.mock || false,
      });
    }).catch(() => {});
  }, [project]);

  // Load table data
  const loadTableData = useCallback(
    async (table, page = 1) => {
      if (!project || !selectedDb || !table) return;
      setLoading(true);
      setError('');
      try {
        const [rowResult, schemaResult] = await Promise.all([
          databaseAPI.getRows(project, table, selectedDb, page),
          databaseAPI.getSchema(project, table, selectedDb),
        ]);
        setRowData(rowResult);
        setSchema(schemaResult.columns || []);
        setSelectedTable(table);
        setViewMode('data');
      } catch (err) {
        setError(err.message);
      }
      setLoading(false);
    },
    [project, selectedDb]
  );

  const handleRunQuery = useCallback(async () => {
    if (!project || !selectedDb || !query.trim()) return;
    setLoading(true);
    setError('');
    try {
      const result = await databaseAPI.executeQuery(project, selectedDb, query);
      setQueryResult(result);
      setViewMode('query');
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }, [project, selectedDb, query]);

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await databaseAPI.saveConfig(project, dbConfig);
      toast.success('Database configuration saved.');
      // Reload db config (to get masked password)
      const updatedCfg = await databaseAPI.getConfig(project);
      setDbConfig({
        type: updatedCfg.type || 'sqlite',
        host: updatedCfg.host || 'localhost',
        port: updatedCfg.port || 3306,
        user: updatedCfg.user || 'root',
        password: updatedCfg.password || '',
        database: updatedCfg.database || '',
        mock: updatedCfg.mock || false,
      });
      // Refresh DB list
      const dbData = await databaseAPI.listDatabases(project);
      setDatabases(dbData.databases || []);
      if (dbData.databases?.length > 0) {
        setSelectedDb(dbData.databases[0].path);
      } else {
        setSelectedDb('');
        setTables([]);
      }
      setShowConfig(false);
    } catch (err) {
      setError(err.message);
      toast.error(err.message || 'Failed to save configuration.');
    }
    setLoading(false);
  };

  const handleProvisionConfig = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await databaseAPI.provision(project, dbConfig);
      toast.success(res.message || 'Database provisioned successfully!');
      
      const updatedCfg = await databaseAPI.getConfig(project);
      setDbConfig({
        type: updatedCfg.type || 'sqlite',
        host: updatedCfg.host || 'localhost',
        port: updatedCfg.port || 3306,
        user: updatedCfg.user || 'root',
        password: updatedCfg.password || '',
        database: updatedCfg.database || '',
        mock: updatedCfg.mock || false,
      });
      
      const dbData = await databaseAPI.listDatabases(project);
      setDatabases(dbData.databases || []);
      if (dbData.databases?.length > 0) {
        const match = dbData.databases.find(db => db.path.startsWith(dbConfig.type));
        setSelectedDb(match ? match.path : dbData.databases[0].path);
      } else {
        setSelectedDb('');
        setTables([]);
      }
      setShowConfig(false);
    } catch (err) {
      setError(err.message);
      toast.error(err.message || 'Failed to provision database.');
    }
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleRunQuery();
    }
  };

  if (!project) {
    return (
      <div className="database-viewer">
        <div className="db-empty">
          <VscDatabase style={{ fontSize: 32, opacity: 0.3 }} />
          <p>Open a project to browse databases</p>
        </div>
      </div>
    );
  }

  return (
    <div className="database-viewer" id="database-viewer">
      <div className="db-header">
        <h3>Database</h3>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            className={`btn btn-sm ${showConfig ? 'active' : ''}`}
            onClick={() => setShowConfig(!showConfig)}
            title="Database Connection Config"
          >
            <VscSettings /> Config
          </button>
          <button
            className="btn btn-sm"
            onClick={loadDatabasesList}
          >
            <VscRefresh /> Refresh
          </button>
        </div>
      </div>

      <div className="db-content">
        {/* Sidebar: DB and Table list */}
        <div className="db-sidebar">
          <div className="db-sidebar-section">Database</div>
          {databases.length > 0 ? (
            <select
              className="db-select"
              value={selectedDb}
              onChange={(e) => setSelectedDb(e.target.value)}
            >
              {databases.map((db) => (
                <option key={db.path} value={db.path}>
                  {db.name}
                </option>
              ))}
            </select>
          ) : (
            <div style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-tertiary)' }}>
              No database connections found. Configure MySQL in settings.
            </div>
          )}

          <div className="db-sidebar-section">Tables</div>
          {tables.map((table) => (
            <div
              key={table}
              className={`db-table-item ${selectedTable === table ? 'active' : ''}`}
              onClick={() => loadTableData(table)}
            >
              <VscTable className="db-table-icon" />
              {table}
            </div>
          ))}
        </div>

        {/* Main area */}
        <div className="db-main">
          {showConfig ? (
            <div className="db-config-container">
              <h4>Database Settings</h4>
              <form onSubmit={handleSaveConfig} className="db-config-form">
                <div className="db-form-group">
                  <label>Type</label>
                  <select
                    value={dbConfig.type}
                    onChange={(e) => {
                      const type = e.target.value;
                      let port = 3306;
                      if (type === 'postgres') port = 5432;
                      if (type === 'mongodb') port = 27017;
                      setDbConfig({ ...dbConfig, type, port });
                    }}
                    className="db-select"
                  >
                    <option value="sqlite">SQLite (Local Workspace File)</option>
                    <option value="mysql">MySQL (Server Connection)</option>
                    <option value="postgres">PostgreSQL (Server Connection)</option>
                    <option value="mongodb">MongoDB (NoSQL Connection)</option>
                  </select>
                </div>
                
                {dbConfig.type !== 'sqlite' && (
                  <>
                    <div className="db-form-group">
                      <label>Host</label>
                      <input
                        type="text"
                        value={dbConfig.host}
                        onChange={(e) => setDbConfig({ ...dbConfig, host: e.target.value })}
                        className="db-input"
                        placeholder="localhost"
                        required
                      />
                    </div>
                    <div className="db-form-group">
                      <label>Port</label>
                      <input
                        type="number"
                        value={dbConfig.port}
                        onChange={(e) => setDbConfig({ ...dbConfig, port: parseInt(e.target.value) || 3306 })}
                        className="db-input"
                        placeholder="3306"
                        required
                      />
                    </div>
                    <div className="db-form-group">
                      <label>User</label>
                      <input
                        type="text"
                        value={dbConfig.user}
                        onChange={(e) => setDbConfig({ ...dbConfig, user: e.target.value })}
                        className="db-input"
                        placeholder="root"
                        required
                      />
                    </div>
                    <div className="db-form-group">
                      <label>Password</label>
                      <input
                        type="password"
                        value={dbConfig.password}
                        onChange={(e) => setDbConfig({ ...dbConfig, password: e.target.value })}
                        className="db-input"
                        placeholder="••••••••"
                      />
                    </div>
                    <div className="db-form-group">
                      <label>Database</label>
                      <input
                        type="text"
                        value={dbConfig.database}
                        onChange={(e) => setDbConfig({ ...dbConfig, database: e.target.value })}
                        className="db-input"
                        placeholder="my_database"
                        required
                      />
                    </div>
                    <div className="db-form-group checkbox-group" style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '10px' }}>
                      <input
                        type="checkbox"
                        id="db-mock-checkbox"
                        checked={dbConfig.mock}
                        onChange={(e) => setDbConfig({ ...dbConfig, mock: e.target.checked })}
                        style={{ width: 'auto', margin: 0, cursor: 'pointer' }}
                      />
                      <label htmlFor="db-mock-checkbox" style={{ margin: 0, textTransform: 'none', fontSize: '11px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        Simulated Mock Fallback (Useful for testing)
                      </label>
                    </div>
                  </>
                )}
                
                <div style={{ display: 'flex', gap: '8px', marginTop: '18px' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
                    {loading ? 'Saving...' : 'Save Config'}
                  </button>
                  {dbConfig.type !== 'sqlite' && (
                    <button
                      type="button"
                      className="btn btn-primary animate-pulse"
                      style={{ flex: 1, background: 'linear-gradient(135deg, var(--secondary), var(--primary))', border: 'none' }}
                      onClick={handleProvisionConfig}
                      disabled={loading}
                    >
                      {loading ? 'Provisioning...' : 'Provision DB'}
                    </button>
                  )}
                  <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowConfig(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <>
              {/* Query Bar */}
              <div className="db-query-bar">
                <input
                  className="db-query-input"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    selectedDb?.includes('mongodb')
                      ? 'e.g. {"collection": "mongo_tasks", "find": {"status": "completed"}}'
                      : 'SELECT * FROM table_name   (Ctrl+Enter to run)'
                  }
                />
                <button
                  className="db-query-btn"
                  onClick={handleRunQuery}
                  disabled={loading || !query.trim()}
                >
                  {loading ? 'Running...' : 'Run Query'}
                </button>
              </div>
              {selectedDb?.includes('mongodb') && (
                <div className="db-query-tip" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', marginBottom: '8px', paddingLeft: '12px' }}>
                  💡 <strong>MongoDB Query Tip:</strong> Use JSON format specifying collection and query details, e.g.: <code>{"{"}"collection": "col_name", "find": {"{"}...{"}"}, "limit": 50{"}"}</code>
                </div>
              )}

              {error && <div className="db-error">{error}</div>}

              {/* Schema View */}
              {viewMode === 'data' && schema.length > 0 && (
                <div className="db-schema">
                  <div className="db-schema-title">Schema: {selectedTable}</div>
                  <table className="db-schema-table">
                    <thead>
                      <tr>
                        <th>Column</th>
                        <th>Type</th>
                        <th>NOT NULL</th>
                        <th>PK</th>
                        <th>Default</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schema.map((col) => (
                        <tr key={col.name}>
                          <td>{col.name}</td>
                          <td>{col.type || '—'}</td>
                          <td>{col.notnull ? '✓' : ''}</td>
                          <td>{col.pk ? '🔑' : ''}</td>
                          <td className={!col.default_value ? 'null-value' : ''}>
                            {col.default_value ?? 'NULL'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Data Table */}
              <DataTable data={viewMode === 'query' ? queryResult : rowData} />

              {/* Pagination */}
              {viewMode === 'data' && rowData && (
                <div className="db-pagination">
                  <span className="db-pagination-info">
                    Page {rowData.page} of {rowData.total_pages} ({rowData.total} rows)
                  </span>
                  <div className="db-pagination-controls">
                    <button
                      className="db-pagination-btn"
                      disabled={rowData.page <= 1}
                      onClick={() => loadTableData(selectedTable, rowData.page - 1)}
                    >
                      ← Prev
                    </button>
                    <button
                      className="db-pagination-btn"
                      disabled={rowData.page >= rowData.total_pages}
                      onClick={() => loadTableData(selectedTable, rowData.page + 1)}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}

              {!selectedTable && !queryResult && !error && (
                <div className="db-empty">
                  <VscDatabase style={{ fontSize: 32, opacity: 0.3 }} />
                  <p>Select a table to browse data, or run a SQL query</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DataTable({ data }) {
  if (!data || !data.rows || data.rows.length === 0) return null;

  return (
    <div className="db-table-container">
      <table className="db-data-table">
        <thead>
          <tr>
            {data.columns.map((col) => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, i) => (
            <tr key={i}>
              {data.columns.map((col) => (
                <td key={col} className={row[col] === null ? 'null-value' : ''}>
                  {row[col] === null ? 'NULL' : String(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
