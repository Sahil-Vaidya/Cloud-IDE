import React, { useState, useEffect, useCallback } from 'react';
import { VscDatabase, VscTable, VscRefresh } from 'react-icons/vsc';
import { databaseAPI } from '../../utils/api';
import './DatabaseViewer.css';

export default function DatabaseViewer({ project }) {
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

  // Load databases
  useEffect(() => {
    if (!project) return;
    databaseAPI.listDatabases(project).then((data) => {
      setDatabases(data.databases || []);
      if (data.databases?.length > 0) {
        setSelectedDb(data.databases[0].path);
      }
    }).catch(() => {});
  }, [project]);

  // Load tables when DB changes
  useEffect(() => {
    if (!project || !selectedDb) return;
    setError('');
    databaseAPI.listTables(project, selectedDb).then((data) => {
      setTables(data.tables || []);
      setSelectedTable('');
      setRowData(null);
      setSchema([]);
    }).catch((err) => setError(err.message));
  }, [project, selectedDb]);

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
        <button
          className="btn btn-sm"
          onClick={() => {
            databaseAPI.listDatabases(project).then((data) => {
              setDatabases(data.databases || []);
            });
          }}
        >
          <VscRefresh /> Refresh
        </button>
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
              No SQLite files found
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
          {/* Query Bar */}
          <div className="db-query-bar">
            <input
              className="db-query-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="SELECT * FROM table_name   (Ctrl+Enter to run)"
            />
            <button
              className="db-query-btn"
              onClick={handleRunQuery}
              disabled={loading || !query.trim()}
            >
              {loading ? 'Running...' : 'Run Query'}
            </button>
          </div>

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
